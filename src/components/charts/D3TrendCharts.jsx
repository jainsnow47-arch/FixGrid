import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useReducedMotion } from 'motion/react';

function useContainerWidth(ref, fallback = 640) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const next = Math.max(260, Math.floor(el.getBoundingClientRect().width));
      setWidth((prev) => (prev !== next ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/**
 * D3 Multi-Series Area & Line Chart showing Cumulative Civic Improvement Trends over time
 * Supports 'volume' (Submitted vs Active vs Resolved) and 'rate' (Resolution Rate %) modes.
 */
export function D3CivicTrendChart({ data = [], mode = 'volume' }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const width = useContainerWidth(containerRef, 680);
  const reduced = useReducedMotion();
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (!data.length) return;

    const height = 290;
    const margin = { top: 18, right: 20, bottom: 34, left: 42 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const parsed = data.map((d) => ({
      ...d,
      dateObj: new Date(d.timestamp),
    }));

    const xExtent = d3.extent(parsed, (d) => d.dateObj);
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);

    const yMax =
      mode === 'rate'
        ? 100
        : Math.max(
            4,
            d3.max(parsed, (d) => Math.max(d.cumulativeSubmitted, d.cumulativeResolved, d.cumulativeActive)) || 4
          );
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    const defs = svg.append('defs');

    const greenGrad = defs
      .append('linearGradient')
      .attr('id', 'fg-d3-green-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    greenGrad.append('stop').attr('offset', '0%').attr('stop-color', '#245B45').attr('stop-opacity', 0.34);
    greenGrad.append('stop').attr('offset', '100%').attr('stop-color', '#D5EBDD').attr('stop-opacity', 0.04);

    const orangeGrad = defs
      .append('linearGradient')
      .attr('id', 'fg-d3-orange-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    orangeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#F07832').attr('stop-opacity', 0.24);
    orangeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#F07832').attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'fg-grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat('')
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid.selectAll('line').attr('stroke', 'rgba(36,91,69,0.1)').attr('stroke-dasharray', '3 3')
      );

    // X & Y Axes
    const tickCount = Math.min(parsed.length, width < 500 ? 4 : 7);
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(tickCount))
      .call((ax) => ax.select('.domain').attr('stroke', 'rgba(36,91,69,0.22)'))
      .call((ax) => ax.selectAll('line').attr('stroke', 'rgba(36,91,69,0.2)'))
      .call((ax) => ax.selectAll('text').attr('fill', '#55665F').attr('font-size', '11px'));

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((v) => (mode === 'rate' ? `${v}%` : `${Math.round(v)}`))
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#55665F').attr('font-size', '11px'));

    const animatePathStroke = (pathSel) => {
      if (reduced) return;
      const node = pathSel.node();
      if (!node || typeof node.getTotalLength !== 'function') return;
      const len = node.getTotalLength();
      pathSel
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', () => pathSel.attr('stroke-dasharray', null));
    };

    if (mode === 'rate') {
      const rateArea = d3
        .area()
        .x((d) => xScale(d.dateObj))
        .y0(innerH)
        .y1((d) => yScale(d.resolutionRatePct))
        .curve(d3.curveMonotoneX);

      const rateLine = d3
        .line()
        .x((d) => xScale(d.dateObj))
        .y((d) => yScale(d.resolutionRatePct))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(parsed).attr('fill', 'url(#fg-d3-green-area)').attr('d', rateArea);
      const ratePath = g
        .append('path')
        .datum(parsed)
        .attr('fill', 'none')
        .attr('stroke', '#245B45')
        .attr('stroke-width', 2.75)
        .attr('d', rateLine);
      animatePathStroke(ratePath);

      g.selectAll('.fg-rate-dot')
        .data(parsed)
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.dateObj))
        .attr('cy', (d) => yScale(d.resolutionRatePct))
        .attr('r', 3.5)
        .attr('fill', '#FAF8EE')
        .attr('stroke', '#245B45')
        .attr('stroke-width', 2);
    } else {
      const submittedLine = d3
        .line()
        .x((d) => xScale(d.dateObj))
        .y((d) => yScale(d.cumulativeSubmitted))
        .curve(d3.curveMonotoneX);

      const activeArea = d3
        .area()
        .x((d) => xScale(d.dateObj))
        .y0(innerH)
        .y1((d) => yScale(d.cumulativeActive))
        .curve(d3.curveMonotoneX);

      const activeLine = d3
        .line()
        .x((d) => xScale(d.dateObj))
        .y((d) => yScale(d.cumulativeActive))
        .curve(d3.curveMonotoneX);

      const resolvedArea = d3
        .area()
        .x((d) => xScale(d.dateObj))
        .y0(innerH)
        .y1((d) => yScale(d.cumulativeResolved))
        .curve(d3.curveMonotoneX);

      const resolvedLine = d3
        .line()
        .x((d) => xScale(d.dateObj))
        .y((d) => yScale(d.cumulativeResolved))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(parsed).attr('fill', 'url(#fg-d3-orange-area)').attr('d', activeArea);
      g.append('path').datum(parsed).attr('fill', 'url(#fg-d3-green-area)').attr('d', resolvedArea);

      g.append('path')
        .datum(parsed)
        .attr('fill', 'none')
        .attr('stroke', '#55665F')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5 4')
        .attr('d', submittedLine);

      const activePath = g
        .append('path')
        .datum(parsed)
        .attr('fill', 'none')
        .attr('stroke', '#F07832')
        .attr('stroke-width', 2.25)
        .attr('d', activeLine);
      animatePathStroke(activePath);

      const resolvedPath = g
        .append('path')
        .datum(parsed)
        .attr('fill', 'none')
        .attr('stroke', '#245B45')
        .attr('stroke-width', 2.75)
        .attr('d', resolvedLine);
      animatePathStroke(resolvedPath);

      g.selectAll('.fg-resolved-dot')
        .data(parsed)
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.dateObj))
        .attr('cy', (d) => yScale(d.cumulativeResolved))
        .attr('r', 3.5)
        .attr('fill', '#FAF8EE')
        .attr('stroke', '#245B45')
        .attr('stroke-width', 2);
    }

    // Crosshair indicator + invisible overlay for mouse/touch inspection
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#245B45')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
      .style('opacity', 0);

    const focusDot = g
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#F07832')
      .attr('stroke', '#FAF8EE')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    const bisect = d3.bisector((d) => d.dateObj).left;

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove touchmove', (event) => {
        const [mx] = d3.pointer(event);
        const xDate = xScale.invert(mx);
        const idx = bisect(parsed, xDate, 1);
        const d0 = parsed[idx - 1];
        const d1 = parsed[idx];
        const chosen = !d1 ? d0 : !d0 ? d1 : xDate - d0.dateObj > d1.dateObj - xDate ? d1 : d0;
        if (!chosen) return;

        const cx = xScale(chosen.dateObj);
        const cy = yScale(mode === 'rate' ? chosen.resolutionRatePct : chosen.cumulativeResolved);
        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.6);
        focusDot.attr('cx', cx).attr('cy', cy).style('opacity', 1);

        setHoverInfo({
          datum: chosen,
          x: margin.left + cx,
          y: margin.top + cy,
        });
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        focusDot.style('opacity', 0);
        setHoverInfo(null);
      });
  }, [data, mode, width, reduced]);

  if (!data.length) {
    return (
      <div className="h-[290px] flex items-center justify-center text-xs text-[#55665F]">
        No time-series data matches the current filters.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg ref={svgRef} width={width} height={290} className="block overflow-visible" />
      {hoverInfo && (
        <div
          style={{
            left: Math.min(Math.max(12, hoverInfo.x - 95), Math.max(12, width - 210)),
            top: 8,
          }}
          className="pointer-events-none absolute z-20 w-48 rounded-xl bg-[#FAF8EE] border border-[#245B45]/25 shadow-lg px-3 py-2.5 text-xs space-y-1"
        >
          <p className="font-bold text-[#245B45] border-b border-[#245B45]/10 pb-1">
            {hoverInfo.datum.label}
          </p>
          <div className="flex justify-between">
            <span className="text-[#55665F]">Total Submitted</span>
            <span className="font-mono-tabular font-semibold text-[#24332D]">
              {hoverInfo.datum.cumulativeSubmitted}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#55665F]">Active Repairs</span>
            <span className="font-mono-tabular font-semibold text-[#D96522]">
              {hoverInfo.datum.cumulativeActive}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#55665F]">Resolved</span>
            <span className="font-mono-tabular font-semibold text-[#245B45]">
              {hoverInfo.datum.cumulativeResolved}
            </span>
          </div>
          <div className="flex justify-between pt-0.5 border-t border-[#245B45]/10">
            <span className="text-[#55665F]">Resolution Rate</span>
            <span className="font-mono-tabular font-bold text-[#245B45]">
              {hoverInfo.datum.resolutionRatePct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * D3 Grouped Bar Chart comparing Newly Submitted vs. Resolved issues per time interval
 */
export function D3DailyActivityChart({ data = [] }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const width = useContainerWidth(containerRef, 520);
  const reduced = useReducedMotion();
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (!data.length) return;

    const height = 250;
    const margin = { top: 16, right: 16, bottom: 40, left: 36 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const subgroups = ['submittedInBucket', 'resolvedInBucket'];
    const labels = data.map((d) => d.label);

    const x0 = d3.scaleBand().domain(labels).range([0, innerW]).padding(0.28);
    const x1 = d3.scaleBand().domain(subgroups).range([0, x0.bandwidth()]).padding(0.14);

    const yMax = Math.max(
      2,
      d3.max(data, (d) => Math.max(d.submittedInBucket, d.resolvedInBucket)) || 2
    );
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);
    const color = d3.scaleOrdinal().domain(subgroups).range(['#F07832', '#245B45']);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat(''))
      .call((grid) => grid.select('.domain').remove())
      .call((grid) => grid.selectAll('line').attr('stroke', 'rgba(36,91,69,0.1)').attr('stroke-dasharray', '3 3'));

    const step = Math.max(1, Math.ceil(labels.length / (width < 480 ? 4 : 8)));
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x0).tickValues(labels.filter((_, i) => i % step === 0))
      )
      .call((ax) => ax.select('.domain').attr('stroke', 'rgba(36,91,69,0.2)'))
      .call((ax) => ax.selectAll('text').attr('fill', '#55665F').attr('font-size', '10px'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#55665F').attr('font-size', '11px'));

    const groups = g
      .selectAll('.fg-bar-group')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d.label)},0)`);

    const rects = groups
      .selectAll('rect')
      .data((d) =>
        subgroups.map((key) => ({
          key,
          value: d[key] || 0,
          label: d.label,
          submitted: d.submittedInBucket,
          resolved: d.resolvedInBucket,
        }))
      )
      .enter()
      .append('rect')
      .attr('x', (d) => x1(d.key))
      .attr('width', Math.max(4, x1.bandwidth()))
      .attr('rx', 3)
      .attr('fill', (d) => color(d.key))
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const parentX = x0(d.label) || 0;
        setHoveredBar({
          ...d,
          x: margin.left + parentX + (x1(d.key) || 0),
        });
      })
      .on('mouseleave', () => setHoveredBar(null));

    if (reduced) {
      rects.attr('y', (d) => y(d.value)).attr('height', (d) => innerH - y(d.value));
    } else {
      rects
        .attr('y', innerH)
        .attr('height', 0)
        .transition()
        .duration(480)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => y(d.value))
        .attr('height', (d) => innerH - y(d.value));
    }
  }, [data, width, reduced]);

  if (!data.length) {
    return (
      <div className="h-[250px] flex items-center justify-center text-xs text-[#55665F]">
        No activity buckets available yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg ref={svgRef} width={width} height={250} className="block overflow-visible" />
      {hoveredBar && (
        <div
          style={{
            left: Math.min(Math.max(8, hoveredBar.x - 60), Math.max(8, width - 165)),
            top: 6,
          }}
          className="pointer-events-none absolute z-20 w-40 rounded-lg bg-[#FAF8EE] border border-[#245B45]/25 shadow-md px-2.5 py-2 text-xs space-y-0.5"
        >
          <p className="font-bold text-[#245B45]">{hoveredBar.label}</p>
          <p className="text-[#D96522] font-medium">Submitted: {hoveredBar.submitted}</p>
          <p className="text-[#245B45] font-medium">Resolved: {hoveredBar.resolved}</p>
        </div>
      )}
    </div>
  );
}

/**
 * D3 Horizontal Stacked Bar Chart showing Resolution Breakdown by Issue Category
 */
export function D3CategoryProgressChart({ data = [] }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const width = useContainerWidth(containerRef, 520);
  const reduced = useReducedMotion();
  const [hoveredCat, setHoveredCat] = useState(null);

  const rowHeight = 38;
  const chartHeight = Math.max(160, data.length * rowHeight + 36);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (!data.length) return;

    const margin = { top: 10, right: 64, bottom: 24, left: width < 440 ? 118 : 165 };
    const innerW = Math.max(80, width - margin.left - margin.right);
    const innerH = chartHeight - margin.top - margin.bottom;

    const keys = ['resolved', 'active', 'pending', 'escalated'];
    const color = d3
      .scaleOrdinal()
      .domain(keys)
      .range(['#245B45', '#7DBE9E', '#C4841D', '#9B2226']);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.category))
      .range([0, innerH])
      .padding(0.32);

    const maxTotal = Math.max(1, d3.max(data, (d) => d.total) || 1);
    const x = d3.scaleLinear().domain([0, maxTotal]).nice().range([0, innerW]);

    const stacked = d3.stack().keys(keys)(data);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(maxTotal, 5)).tickFormat(d3.format('d')))
      .call((ax) => ax.select('.domain').attr('stroke', 'rgba(36,91,69,0.2)'))
      .call((ax) => ax.selectAll('text').attr('fill', '#55665F').attr('font-size', '10px'));

    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#24332D')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text((txt) => (txt.length > 20 && width < 480 ? `${txt.slice(0, 18)}…` : txt))
      );

    const layers = g
      .selectAll('.fg-stack-layer')
      .data(stacked)
      .enter()
      .append('g')
      .attr('fill', (d) => color(d.key));

    const rects = layers
      .selectAll('rect')
      .data((d) => d.map((seg) => ({ seg, key: d.key })))
      .enter()
      .append('rect')
      .attr('y', (d) => y(d.seg.data.category))
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (_ev, d) => {
        setHoveredCat({
          datum: d.seg.data,
          y: margin.top + (y(d.seg.data.category) || 0),
        });
      })
      .on('mouseleave', () => setHoveredCat(null));

    if (reduced) {
      rects
        .attr('x', (d) => x(d.seg[0]))
        .attr('width', (d) => Math.max(0, x(d.seg[1]) - x(d.seg[0])));
    } else {
      rects
        .attr('x', 0)
        .attr('width', 0)
        .transition()
        .duration(520)
        .ease(d3.easeCubicOut)
        .attr('x', (d) => x(d.seg[0]))
        .attr('width', (d) => Math.max(0, x(d.seg[1]) - x(d.seg[0])));
    }

    // Right-hand resolution summary label per category
    g.selectAll('.fg-cat-rate')
      .data(data)
      .enter()
      .append('text')
      .attr('x', (d) => x(d.total) + 8)
      .attr('y', (d) => (y(d.category) || 0) + y.bandwidth() / 2 + 4)
      .attr('fill', '#245B45')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d) => `${d.resolved}/${d.total} (${d.resolutionRatePct}%)`);
  }, [data, width, chartHeight, reduced]);

  if (!data.length) {
    return (
      <div className="h-[180px] flex items-center justify-center text-xs text-[#55665F]">
        No category breakdown matches the selected filter.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg ref={svgRef} width={width} height={chartHeight} className="block overflow-visible" />
      {hoveredCat && (
        <div
          style={{
            right: 12,
            top: Math.max(4, hoveredCat.y - 12),
          }}
          className="pointer-events-none absolute z-20 w-44 rounded-lg bg-[#FAF8EE] border border-[#245B45]/25 shadow-md px-3 py-2 text-xs space-y-0.5"
        >
          <p className="font-bold text-[#245B45] truncate">{hoveredCat.datum.category}</p>
          <p className="text-[#245B45]">Resolved: {hoveredCat.datum.resolved}</p>
          <p className="text-[#3C6E58]">In Progress: {hoveredCat.datum.active}</p>
          <p className="text-[#8C520A]">Awaiting Review: {hoveredCat.datum.pending}</p>
          <p className="text-[#9B2226]">Escalated: {hoveredCat.datum.escalated}</p>
        </div>
      )}
    </div>
  );
}
