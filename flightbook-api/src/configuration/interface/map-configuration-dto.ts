import { ApiProperty } from "@nestjs/swagger";

export class MapConfigurationDto {
    @ApiProperty()
    readonly url: string;
    @ApiProperty()
    readonly attributions: string;
    @ApiProperty()
    readonly crossOrigin: string;
    /** Terrain-RGB tiles used for the hillshaded relief layer. */
    @ApiProperty()
    readonly terrainUrl: string;
    @ApiProperty()
    readonly terrainAttributions: string;
}
