import { HubType } from 'rxpoweredup';

export const HUB_TYPE_TO_L10N_MAPPING: Readonly<{ [type in HubType]: string }> = {
    [HubType.BoostHub]: 'hubTypes.boost',
    [HubType.WeDoHub]: 'hubTypes.weDo',
    [HubType.DuploTrain]: 'hubTypes.duploTrain',
    [HubType.TwoPortHub]: 'hubTypes.twoPortHub',
    [HubType.TwoPortHandset]: 'hubTypes.twoPortHandset',
    [HubType.FourPortHub]: 'hubTypes.fourPortHub',
    [HubType.Unknown]: 'hubTypes.unknown'
};
