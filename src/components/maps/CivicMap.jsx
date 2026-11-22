import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CATEGORY_COLORS } from '../../utils/formatters.js';

const MATHURA_CENTER = [27.4924, 77.6737];

export function CivicMap({
  complaints = [],
  mode = 'markers', // 'markers' | 'clusters' | 'heatmap'
  height = '380px',
  pickLocationMode = false,
  selectedPosition = null,
  onPickPosition = null,
  onSelectComplaint = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const pickMarkerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: selectedPosition ? [selectedPosition.lat, selectedPosition.lng] : MATHURA_CENTER,
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (pickLocationMode && onPickPosition) {
      map.on('click', (e) => {
        onPickPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      pickMarkerRef.current = null;
    };
  }, []);

  // Update picked pin in location picker mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickLocationMode) return;

    if (selectedPosition) {
      const latlng = [Number(selectedPosition.lat), Number(selectedPosition.lng)];
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLatLng(latlng);
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
                   <span class="fg-pulse-ring" style="position:absolute;width:24px;height:24px;border-radius:9999px;background:rgba(240,120,50,0.4);"></span>
                   <span style="width:14px;height:14px;border-radius:9999px;background:#F07832;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></span>
                 </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        pickMarkerRef.current = L.marker(latlng, { icon, draggable: true }).addTo(map);
        pickMarkerRef.current.on('dragend', () => {
          const pos = pickMarkerRef.current.getLatLng();
          onPickPosition?.({ lat: pos.lat, lng: pos.lng });
        });
      }
      map.panTo(latlng, { animate: true });
    }
  }, [selectedPosition, pickLocationMode, onPickPosition]);

  // Render complaint markers, clusters, or heatmap hotspots
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (mode === 'heatmap') {
      const sevWeight = { Critical: 1.0, High: 0.78, Medium: 0.55, Low: 0.35 };
      complaints.forEach((c) => {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const w = sevWeight[c.severity] || 0.5;
        const color = c.severity === 'Critical' ? '#D9381E' : c.severity === 'High' ? '#F07832' : '#245B45';

        // Multi-ring radial density hotspot visualization
        L.circle([lat, lng], {
          radius: 420 * w,
          stroke: false,
          fillColor: color,
          fillOpacity: 0.16,
        }).addTo(group);

        L.circle([lat, lng], {
          radius: 190 * w,
          stroke: true,
          weight: 1,
          color,
          fillColor: color,
          fillOpacity: 0.34,
        })
          .bindPopup(
            `<div style="min-width:190px;">
              <div style="font-weight:700;color:#245B45;font-size:12px;">${escapeHtml(c.tracking_code)} · ${escapeHtml(c.severity)}</div>
              <div style="font-weight:600;margin-top:2px;font-size:13px;">${escapeHtml(c.title)}</div>
              <div style="font-size:11px;color:#55665F;margin-top:4px;">${escapeHtml(c.ward || c.address)}</div>
            </div>`
          )
          .addTo(group);
      });
      return;
    }

    if (mode === 'clusters') {
      const buckets = new Map();
      complaints.forEach((c) => {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const key = `${(Math.round(lat * 120) / 120).toFixed(3)}_${(Math.round(lng * 120) / 120).toFixed(3)}`;
        const entry = buckets.get(key) || { latSum: 0, lngSum: 0, items: [] };
        entry.latSum += lat;
        entry.lngSum += lng;
        entry.items.push(c);
        buckets.set(key, entry);
      });

      buckets.forEach((bucket) => {
        const avgLat = bucket.latSum / bucket.items.length;
        const avgLng = bucket.lngSum / bucket.items.length;
        if (bucket.items.length === 1) {
          addSingleMarker(bucket.items[0], group, onSelectComplaint);
        } else {
          const hasUrgent = bucket.items.some((i) => i.severity === 'Critical' || i.is_overdue);
          const bg = hasUrgent ? '#F07832' : '#245B45';
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:36px;height:36px;border-radius:9999px;background:${bg};color:#fff;border:3px solid #FAF8EE;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.28);">${bucket.items.length}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          const marker = L.marker([avgLat, avgLng], { icon }).addTo(group);
          const listHtml = bucket.items
            .slice(0, 4)
            .map((i) => `<li style="margin-top:3px;"><strong>${escapeHtml(i.tracking_code)}</strong>: ${escapeHtml(i.category)} (${escapeHtml(i.status)})</li>`)
            .join('');
          marker.bindPopup(
            `<div style="min-width:210px;">
              <div style="font-weight:700;color:#245B45;font-size:12px;">Cluster: ${bucket.items.length} Issues in Vicinity</div>
              <ul style="padding-left:14px;margin:4px 0;font-size:11px;">${listHtml}</ul>
            </div>`
          );
          marker.on('click', () => {
            map.setView([avgLat, avgLng], Math.min(16, map.getZoom() + 2));
          });
        }
      });
      return;
    }

    // Default: individual category-colored markers
    complaints.forEach((c) => addSingleMarker(c, group, onSelectComplaint));
  }, [complaints, mode, onSelectComplaint]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-[#245B45]/20"
    />
  );
}

function addSingleMarker(c, group, onSelectComplaint) {
  const lat = Number(c.latitude);
  const lng = Number(c.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const color = CATEGORY_COLORS[c.category] || '#245B45';
  const urgent = c.severity === 'Critical' || c.is_overdue || c.status === 'Escalated';

  const icon = L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
             ${urgent ? `<span class="fg-pulse-ring" style="position:absolute;width:24px;height:24px;border-radius:9999px;background:rgba(240,120,50,0.45);"></span>` : ''}
             <span style="width:14px;height:14px;border-radius:9999px;background:${color};border:2.5px solid #FAF8EE;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></span>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const marker = L.marker([lat, lng], { icon }).addTo(group);
  marker.bindPopup(
    `<div style="min-width:210px;">
      <div style="font-size:11px;font-weight:700;color:${color};">${escapeHtml(c.category)} · ${escapeHtml(c.severity)}</div>
      <div style="font-size:13px;font-weight:700;color:#24332D;margin-top:2px;">${escapeHtml(c.title)}</div>
      <div style="font-size:11px;color:#55665F;margin-top:4px;">${escapeHtml(c.tracking_code)} · ${escapeHtml(c.status)}</div>
      <div style="font-size:11px;color:#55665F;margin-top:2px;">${escapeHtml(c.address)}</div>
    </div>`
  );
  if (onSelectComplaint) {
    marker.on('click', () => onSelectComplaint(c));
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
