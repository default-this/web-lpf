import { Injectable } from '@angular/core';
import { HUB_DEVICE_TYPE_MAP, HubProperty, HubType, MessageType } from '../../constants';
import { IReplyParser } from '../i-reply-parser';
import { RawMessage } from '../raw-message';
import {
    HubPropertyBatteryInboundMessage,
    HubPropertyInboundMessage,
    HubPropertyRssiInboundMessage,
    HubPropertySystemTypeIdInboundMessage,
    InboundMessage
} from '../inbound-message';

@Injectable()
export class HubPropertiesReplyParserService implements IReplyParser<MessageType.properties> {
    public readonly messageType = MessageType.properties;

    private readonly hubPropertyLength = 1;

    private readonly operationLength = 1;

    private readonly hubPropertyValueParser = {
        [HubProperty.batteryVoltage]: (v): HubPropertyBatteryInboundMessage => this.parseBatteryData(v),
        [HubProperty.rssi]: (v): HubPropertyRssiInboundMessage => this.parseRssiLevel(v),
        [HubProperty.systemTypeId]: (v): HubPropertySystemTypeIdInboundMessage => this.parseSystemTypeId(v)
    } satisfies { [k in HubProperty]: (payload: Uint8Array) => HubPropertyInboundMessage };

    public parseMessage(
        message: RawMessage<MessageType.properties>
    ): InboundMessage & { messageType: MessageType.properties } {
        const propertyType = message.payload[0] as HubProperty;
        const payload = message.payload.slice(this.hubPropertyLength + this.operationLength);
        return this.hubPropertyValueParser[propertyType](payload);
    }

    private parseBatteryData(payload: Uint8Array): HubPropertyBatteryInboundMessage {
        return {
            messageType: MessageType.properties,
            propertyType: HubProperty.batteryVoltage,
            level: payload[0]
        };
    }

    private parseRssiLevel(payload: Uint8Array): HubPropertyRssiInboundMessage {
        return {
            messageType: MessageType.properties,
            propertyType: HubProperty.rssi,
            // rssi is a int8 stored as uint8, so we have to convert it,
            // ref: https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#hub-property-payload
            level: payload[0] << 24 >> 24
        };
    }

    private parseSystemTypeId(payload: Uint8Array): HubPropertySystemTypeIdInboundMessage {
        const systemTypeId = payload[0];
        if (!(systemTypeId in HUB_DEVICE_TYPE_MAP)) {
            return {
                messageType: MessageType.properties,
                propertyType: HubProperty.systemTypeId,
                hubType: HubType.Unknown
            };
        }
        return {
            messageType: MessageType.properties,
            propertyType: HubProperty.systemTypeId,
            hubType: HUB_DEVICE_TYPE_MAP[payload[0] as keyof typeof HUB_DEVICE_TYPE_MAP]
        };
    }
}
