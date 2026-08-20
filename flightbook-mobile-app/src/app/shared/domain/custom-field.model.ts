export enum CustomFieldType {
    TEXT = 'text',
    NUMBER = 'number',
    DATE = 'date',
    BOOLEAN = 'boolean',
    DROPDOWN = 'dropdown'
}

export interface CustomFieldDefinition {
    key: string;
    label: string;
    type: CustomFieldType;
    required: boolean;
    disabled: boolean;
    options?: string[];
}

export interface FlightConfig {
    customFields: CustomFieldDefinition[];
}

export interface CustomValue {
    key: string;
    value: any;
}
