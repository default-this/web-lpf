import { MOTOR_LIMITS } from '@nvsukhanov/rxpoweredup';
import { Dictionary } from '@ngrx/entity';
import { HubIoOperationMode } from '@app/shared';
import { InputGain, controllerInputIdFn } from '@app/store';

import { BaseTaskBuilder } from './base-task-builder';
import {
    ControlSchemeBinding,
    ControlSchemeLinearBinding,
    ControllerInputModel,
    PortCommandTask,
    PortCommandTaskPayload,
    PortCommandTaskType,
    SetLinearSpeedTaskPayload
} from '../../../models';
import { calcInputGain } from './calc-input-gain';

export class SetSpeedTaskBuilder extends BaseTaskBuilder {
    private readonly speedStep = 5;

    private readonly speedSnapThreshold = 10;

    protected buildPayload(
        binding: ControlSchemeBinding,
        inputsState: Dictionary<ControllerInputModel>,
        motorEncoderOffset: number,
        lastExecutedTask: PortCommandTask | null
    ): { payload: SetLinearSpeedTaskPayload; inputTimestamp: number } | null {
        if (binding.operationMode !== HubIoOperationMode.Linear) {
            return null;
        }

        const accelerateInput = inputsState[controllerInputIdFn(binding.inputs.accelerate)];
        const accelerateInputValue = accelerateInput?.value ?? 0;

        // brake input is ignored for toggle bindings
        if (binding.isToggle) {
            if (accelerateInputValue === 0) {
                return null;
            }
            const payload = this.createTogglePayload(binding, lastExecutedTask);
            if (payload) {
                return { payload, inputTimestamp: accelerateInput?.timestamp ?? Date.now() };
            }
            return null;
        }

        const brakeInput = binding.inputs.brake
                           ? inputsState[controllerInputIdFn(binding.inputs.brake)]
                           : undefined;
        const brakeInputValue = brakeInput?.value ?? 0;
        const targetSpeed = this.calculateSpeed(
            accelerateInputValue,
            brakeInputValue,
            binding.maxSpeed,
            binding.invert,
            binding.inputs.accelerate.gain
        );

        const payload: SetLinearSpeedTaskPayload = {
            taskType: PortCommandTaskType.SetSpeed,
            speed: targetSpeed,
            power: this.calculatePower(targetSpeed, brakeInputValue, binding.power),
            activeInput: accelerateInputValue !== 0,
            useAccelerationProfile: binding.useAccelerationProfile,
            useDecelerationProfile: binding.useDecelerationProfile
        };

        return { payload, inputTimestamp: accelerateInput?.timestamp ?? Date.now() };
    }

    protected buildCleanupPayload(
        previousTask: PortCommandTask
    ): PortCommandTaskPayload | null {
        if (previousTask.payload.taskType !== PortCommandTaskType.SetSpeed) {
            return null;
        }
        return {
            taskType: PortCommandTaskType.SetSpeed,
            speed: 0,
            power: 0,
            activeInput: false,
            useAccelerationProfile: previousTask.payload.useAccelerationProfile,
            useDecelerationProfile: previousTask.payload.useDecelerationProfile
        };
    }

    private createTogglePayload(
        binding: ControlSchemeLinearBinding,
        lastExecutedTask: PortCommandTask | null
    ): SetLinearSpeedTaskPayload | null {
        let shouldActivate: boolean;
        const assumedBrakeInput = 0;

        if (lastExecutedTask?.bindingId === binding.id) {
            shouldActivate = (lastExecutedTask.payload as SetLinearSpeedTaskPayload).speed === 0;
        } else {
            shouldActivate = true;
        }

        if (shouldActivate) {
            const speed = this.calculateSpeed(
                1,
                assumedBrakeInput,
                binding.maxSpeed,
                binding.invert,
                binding.inputs.accelerate.gain
            );
            return {
                taskType: PortCommandTaskType.SetSpeed,
                speed,
                power: this.calculatePower(speed, assumedBrakeInput, binding.power),
                activeInput: true,
                useAccelerationProfile: binding.useAccelerationProfile,
                useDecelerationProfile: binding.useDecelerationProfile
            };
        }

        return {
            taskType: PortCommandTaskType.SetSpeed,
            speed: 0,
            power: this.calculatePower(0, assumedBrakeInput, binding.power),
            activeInput: true,
            useAccelerationProfile: binding.useAccelerationProfile,
            useDecelerationProfile: binding.useDecelerationProfile
        };
    }

    private calculateSpeed(
        accelerateInput: number,
        brakeInput: number,
        maxAbsSpeed: number,
        invert: boolean,
        inputGain: InputGain
    ): number {
        if (accelerateInput === 0) {
            return 0;
        }
        const outputValue = Math.sign(accelerateInput) * (Math.abs(accelerateInput) - Math.abs(brakeInput));
        const clampedSpeed = this.clampSpeed(
            calcInputGain(outputValue, inputGain) * maxAbsSpeed
        );
        const direction = invert ? -1 : 1;

        return this.snapSpeed(clampedSpeed * direction);
    }

    private clampSpeed(
        speed: number,
    ): number {
        return Math.abs(speed) > MOTOR_LIMITS.maxSpeed
               ? MOTOR_LIMITS.maxSpeed * Math.sign(speed)
               : speed;
    }

    private snapSpeed(
        speed: number,
    ): number {
        const speedWithStep = Math.round(speed / this.speedStep) * this.speedStep;
        if (Math.abs(speedWithStep) < this.speedSnapThreshold) {
            return 0;
        }
        if (Math.abs(speedWithStep) >= MOTOR_LIMITS.maxSpeed - this.speedSnapThreshold) {
            return MOTOR_LIMITS.maxSpeed * Math.sign(speedWithStep);
        }
        return speed;
    }

    private calculatePower(
        accelerateInput: number,
        brakeInput: number,
        maxPower: number
    ): number {
        if (accelerateInput === 0 && brakeInput === 0) {
            return 0;
        }
        if (accelerateInput !== 0) {
            return maxPower;
        }
        return maxPower * brakeInput;
    }
}
