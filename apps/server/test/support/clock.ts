import type { Clock } from '../../src/deps';

export class FakeClock implements Clock {
  private ms: number;

  constructor(iso = '2026-10-06T10:00:00.000Z') {
    this.ms = new Date(iso).getTime();
  }

  now(): Date {
    return new Date(this.ms);
  }

  set(iso: string): void {
    this.ms = new Date(iso).getTime();
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}
