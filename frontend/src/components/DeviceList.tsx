'use client';

export interface Device {
  socketId: string;
  deviceLabel: string;
  joinedAt: number;
  isHost: boolean;
}

function shortId(socketId: string) {
  return socketId.slice(0, 8);
}

export default function DeviceList({
  devices,
  mySocketId,
  myDeviceLabel,
  onKick,
}: {
  devices: Device[];
  mySocketId: string | null;
  myDeviceLabel?: string;
  onKick: (socketId: string) => void;
}) {
  if (devices.length === 0) return null;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Connected devices ({devices.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {devices.map((d) => {
          const isMe = d.socketId === mySocketId;
          return (
            <div
              key={d.socketId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--panel-2)',
                border: isMe ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 14,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>
                  <span
                    className="dot"
                    style={{ display: 'inline-block', background: 'var(--accent-2)', marginRight: 6 }}
                  />
                  {isMe ? myDeviceLabel || d.deviceLabel : d.deviceLabel}
                  {isMe && ' (this device)'}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 999,
                      color: d.isHost ? 'var(--accent)' : 'var(--text-dim)',
                      border: `1px solid ${d.isHost ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {d.isHost ? 'Host · generated' : 'Joined'}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                  id: {shortId(d.socketId)}
                </span>
              </span>
              {!isMe && (
                <button
                  className="btn danger"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => onKick(d.socketId)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
