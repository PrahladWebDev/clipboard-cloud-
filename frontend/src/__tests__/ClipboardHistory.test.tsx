import { render, screen, fireEvent } from '@testing-library/react';
import ClipboardHistory, { ClipboardItem } from '@/components/ClipboardHistory';

jest.mock('@/lib/api', () => ({ fileDownloadUrl: (url: string) => url }));
jest.mock('@/lib/crypto', () => ({ decryptText: jest.fn(), decryptBlob: jest.fn() }));
jest.mock('@/lib/auth', () => ({ saveSnippet: jest.fn() }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const items: ClipboardItem[] = [
  { id: '1', type: 'text', content: 'the quick brown fox', pinned: false, createdAt: Date.now(), deviceLabel: 'Mac' },
  { id: '2', type: 'url', content: 'https://example.com', pinned: true, createdAt: Date.now(), deviceLabel: 'Android' },
];

describe('ClipboardHistory', () => {
  it('renders all items by default', () => {
    render(
      <ClipboardHistory items={items} sessionId="s1" encryptionKey={null} onPin={jest.fn()} onDelete={jest.fn()} />,
    );
    expect(screen.getByText(/the quick brown fox/i)).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('History (2)')).toBeInTheDocument();
  });

  it('filters items via search', () => {
    render(
      <ClipboardHistory items={items} sessionId="s1" encryptionKey={null} onPin={jest.fn()} onDelete={jest.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search history/i), { target: { value: 'quick' } });
    expect(screen.getByText(/the quick brown fox/i)).toBeInTheDocument();
    expect(screen.queryByText('https://example.com')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no items', () => {
    render(
      <ClipboardHistory items={[]} sessionId="s1" encryptionKey={null} onPin={jest.fn()} onDelete={jest.fn()} />,
    );
    expect(screen.getByText(/Nothing copied yet/i)).toBeInTheDocument();
  });

  it('calls onPin when the pin button is clicked', () => {
    const onPin = jest.fn();
    render(
      <ClipboardHistory items={items} sessionId="s1" encryptionKey={null} onPin={onPin} onDelete={jest.fn()} />,
    );
    fireEvent.click(screen.getByText('☆ Pin'));
    expect(onPin).toHaveBeenCalledWith('1', true);
  });

  it('calls onDelete when a delete button is clicked', () => {
    const onDelete = jest.fn();
    render(
      <ClipboardHistory items={items} sessionId="s1" encryptionKey={null} onPin={jest.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('shows an item description and matches it in search', () => {
    const withDesc: ClipboardItem[] = [
      { id: '3', type: 'text', content: 'sk_live_abc123', pinned: false, createdAt: Date.now(), deviceLabel: 'Mac', description: 'Wifi password for the office' },
    ];
    render(
      <ClipboardHistory items={withDesc} sessionId="s1" encryptionKey={null} onPin={jest.fn()} onDelete={jest.fn()} />,
    );
    expect(screen.getByText(/Wifi password for the office/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search history/i), { target: { value: 'office' } });
    expect(screen.getByText(/sk_live_abc123/i)).toBeInTheDocument();
  });
});
