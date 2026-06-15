import { Injectable, Renderer2, RendererFactory2, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DeviceSizeService {

  public isMobile = signal(false);
  private renderer: Renderer2;

  constructor(
    rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.checkDeviceSize(window.innerWidth);

    this.renderer.listen('window', 'resize', (event) => {
      this.checkDeviceSize(event.target.innerWidth);
    });
  }

  private checkDeviceSize(width: number) {
    const isMobile = width < 768;
    this.isMobile.set(isMobile);
  }
}
