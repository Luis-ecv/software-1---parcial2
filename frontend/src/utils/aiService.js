// Simple client-side service to call backend AI endpoints

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function generateDiagram({ type = 'text', content = '', file = null, salaId = null }) {
  const url = `${API_BASE}/apis/ai/generate-diagram`;

  try {
    if (file) {
      const form = new FormData();
      form.append(type === 'voice' ? 'audio' : 'image', file);
      form.append('type', type);
      form.append('salaId', salaId || '');
      // content is optional when sending file
      if (content) form.append('content', content);

      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: form
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI server error: ${resp.status} ${text}`);
      }

      return await resp.json();
    }

    // JSON POST for text
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', content, salaId })
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }

    return await resp.json();
  } catch (error) {
    console.error('generateDiagram error', error);
    throw error;
  }
}
