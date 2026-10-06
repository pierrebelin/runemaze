import { TICK } from '../domain/model/World';

/**
 * Boucle à pas fixe : la simulation avance toujours de 1/60 s, quelle que
 * soit la fréquence d'affichage.
 */
export class GameLoop {
  paused = false;
  private acc = 0;
  private last = 0;
  private raf = 0;
  realTime = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (dt: number) => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.realTime += dt;
      if (!this.paused) {
        this.acc += dt;
        let guard = 0;
        while (this.acc >= TICK && guard++ < 30) {
          this.step();
          this.acc -= TICK;
        }
        if (guard >= 30) this.acc = 0;
      }
      this.render(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
