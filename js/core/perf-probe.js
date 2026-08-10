/**
 * Lightweight, opt-in tick/frame profiler used to decide whether the Phase 6
 * "risky perf" candidates are worth pursuing. It is OFF by default and costs
 * nothing until enabled — the hot paths only run instrumentation behind a
 * truthy `game._profiler` guard.
 *
 * Usage (from the browser console during a representative play session):
 *   game.startPerfProbe();      // begin sampling, auto-reports every 200 ticks
 *   game.startPerfProbe(500);   // ...or choose the report interval (in ticks)
 *   game.stopPerfProbe();       // stop and print a final report
 *   game._profiler.report();    // print an on-demand snapshot without stopping
 *
 * The report lists, per instrumented section: total ms, call count, ms/call,
 * and share of the measured total. Sections are timed with performance.now(),
 * which is monotonic and sub-millisecond on all target browsers. This measures
 * WHERE time goes; it deliberately does not modify any behavior.
 */

export class TickProfiler {
    constructor() {
        // label -> { ms, calls }
        this._buckets = new Map();
        this._lastMark = 0;
        this._ticks = 0;
        this._frames = 0;
        this._startWall = performance.now();
    }

    // Start of a mark chain — call once at the top of the span being profiled.
    begin() {
        this._lastMark = performance.now();
    }

    // Record the time elapsed since the previous begin()/mark() under `label`.
    mark(label) {
        const now = performance.now();
        this._addTo(label, now - this._lastMark);
        this._lastMark = now;
    }

    // Directly attribute an externally-measured duration to `label`.
    add(label, ms) {
        this._addTo(label, ms);
    }

    _addTo(label, ms) {
        let b = this._buckets.get(label);
        if (!b) this._buckets.set(label, b = { ms: 0, calls: 0 });
        b.ms += ms;
        b.calls++;
    }

    countTick() {
        this._ticks++;
    }

    countFrame() {
        this._frames++;
    }

    // Sorted breakdown (descending by total ms), plus context totals.
    snapshot() {
        const rows = [];
        let grand = 0;
        for (const [, b] of this._buckets) grand += b.ms;
        for (const [label, b] of this._buckets) {
            rows.push({
                section: label,
                totalMs: +b.ms.toFixed(1),
                calls: b.calls,
                msPerCall: +(b.ms / b.calls).toFixed(4),
                pct: grand > 0 ? +(100 * b.ms / grand).toFixed(1) : 0,
            });
        }
        rows.sort((a, b) => b.totalMs - a.totalMs);
        return {
            rows,
            ticks: this._ticks,
            frames: this._frames,
            wallMs: +(performance.now() - this._startWall).toFixed(0),
            totalMeasuredMs: +grand.toFixed(1),
        };
    }

    report() {
        const s = this.snapshot();
        // console.table renders the sorted rows; the header line carries context.
        console.log(
            `[perf] ${s.ticks} ticks / ${s.frames} frames over ${s.wallMs}ms wall; ` +
            `measured ${s.totalMeasuredMs}ms across ${s.rows.length} sections`
        );
        console.table(s.rows);
        return s;
    }
}
