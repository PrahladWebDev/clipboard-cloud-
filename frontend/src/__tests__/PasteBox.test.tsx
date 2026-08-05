import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasteBox from '@/components/PasteBox';

jest.mock('@/lib/api', () => ({ uploadFile: jest.fn() }));
jest.mock('@/lib/crypto', () => ({ encryptBlob: jest.fn() }));

describe('PasteBox', () => {
  it('detects plain text and sends type "text"', async () => {
    const onSend = jest.fn().mockResolvedValue({ ok: true });
    render(
      <PasteBox sessionId="s1" encryptionKey={null} onSend={onSend} onImagePasted={jest.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/Type, or paste/i);
    fireEvent.change(textarea, { target: { value: 'just some notes' } });
    fireEvent.click(screen.getByText('Send to other devices'));
    expect(onSend).toHaveBeenCalledWith('text', 'just some notes');
    await waitFor(() => expect(screen.getByText(/Sent/i)).toBeInTheDocument());
  });

  it('detects a URL and sends type "url"', async () => {
    const onSend = jest.fn().mockResolvedValue({ ok: true });
    render(
      <PasteBox sessionId="s1" encryptionKey={null} onSend={onSend} onImagePasted={jest.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/Type, or paste/i);
    fireEvent.change(textarea, { target: { value: 'https://example.com/page' } });
    fireEvent.click(screen.getByText('Send to other devices'));
    expect(onSend).toHaveBeenCalledWith('url', 'https://example.com/page');
    await waitFor(() => expect(screen.getByText(/Sent/i)).toBeInTheDocument());
  });

  it('does not send empty input', () => {
    const onSend = jest.fn().mockResolvedValue({ ok: true });
    render(
      <PasteBox sessionId="s1" encryptionKey={null} onSend={onSend} onImagePasted={jest.fn()} />,
    );
    fireEvent.click(screen.getByText('Send to other devices'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears the textarea after a successful send', async () => {
    const onSend = jest.fn().mockResolvedValue({ ok: true });
    render(
      <PasteBox sessionId="s1" encryptionKey={null} onSend={onSend} onImagePasted={jest.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/Type, or paste/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send to other devices'));
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('keeps the text and shows a failure message when the send fails', async () => {
    const onSend = jest.fn().mockResolvedValue({ ok: false, message: 'Failed to send.' });
    render(
      <PasteBox sessionId="s1" encryptionKey={null} onSend={onSend} onImagePasted={jest.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/Type, or paste/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send to other devices'));
    await waitFor(() => expect(screen.getByText(/Failed to send/i)).toBeInTheDocument());
    expect(textarea.value).toBe('hello');
  });
});
