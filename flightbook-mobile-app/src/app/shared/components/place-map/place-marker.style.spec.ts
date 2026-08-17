import Icon from 'ol/style/Icon';
import { createMarkerStyle } from './place-marker.style';

/**
 * The marker is drawn to a canvas, so nothing in the DOM reveals whether it
 * appeared. What can be asserted is the one thing that was actually broken:
 * that the style's image resolves to something a browser can load.
 */
describe('place marker style', () => {

    it('resolves to an image the browser can load', async () => {
        const icon = createMarkerStyle().getImage() as Icon;
        const src = icon.getSrc();
        expect(src).toBeTruthy();

        await new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`marker image did not load: ${src}`));
            image.src = src;
        });
    });

    /** Anchored at the tip, or the pin points somewhere other than the place. */
    it('anchors the pin at its tip', () => {
        const icon = createMarkerStyle().getImage() as Icon;
        expect(icon.getAnchor()[1]).toBeGreaterThan(icon.getAnchor()[0]);
    });
});
