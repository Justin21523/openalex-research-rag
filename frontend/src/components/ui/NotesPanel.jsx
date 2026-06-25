import { useEffect, useRef, useState } from 'react';
import { StickyNote, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { api } from '../../api/client.js';

const COLORS = [
  { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', dot: 'bg-yellow-400' },
  { id: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
  { id: 'green',  bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  { id: 'red',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-400'    },
];

function colorCfg(id) {
  return COLORS.find((c) => c.id === id) ?? COLORS[0];
}

function NoteItem({ note, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.note_text);
  const [saving, setSaving] = useState(false);
  const cfg = colorCfg(note.color);

  async function save() {
    setSaving(true);
    try {
      await onUpdate(note.annotation_id, { note_text: text });
      setEditing(false);
    } catch {
      // keep editing
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-lg border ${cfg.bg} ${cfg.border} p-3 space-y-1.5`}>
      {note.highlighted_text && (
        <p className="text-xs text-slate-500 italic border-l-2 border-slate-300 pl-2 line-clamp-2">
          "{note.highlighted_text}"
        </p>
      )}

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white"
          />
          <div className="flex gap-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setText(note.note_text); }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
            >
              <X size={10} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm text-slate-700 cursor-pointer hover:text-slate-900 whitespace-pre-wrap"
          onClick={() => setEditing(true)}
        >
          {note.note_text || <span className="italic text-slate-400">Click to edit…</span>}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => onUpdate(note.annotation_id, { color: c.id })}
              className={`w-3.5 h-3.5 rounded-full ${c.dot} ${note.color === c.id ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
              title={c.id}
            />
          ))}
        </div>
        <button
          onClick={() => onDelete(note.annotation_id)}
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function NotesPanel({ workId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState('yellow');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workId) return;
    setLoading(true);
    api.getAnnotations(workId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [workId]);

  async function addNote() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const note = await api.addAnnotation(workId, { note_text: newText.trim(), color: newColor });
      setNotes((n) => [note, ...n]);
      setNewText('');
      setAdding(false);
    } catch {
      // show nothing, keep form open
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id) {
    await api.deleteAnnotation(id);
    setNotes((n) => n.filter((x) => x.annotation_id !== id));
  }

  async function updateNote(id, data) {
    const updated = await api.updateAnnotation(id, data);
    setNotes((n) => n.map((x) => (x.annotation_id === id ? updated : x)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <StickyNote size={14} className="text-amber-500" />
          Notes {notes.length > 0 && <span className="text-slate-400 font-normal">({notes.length})</span>}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus size={12} /> Add Note
        </button>
      </div>

      {adding && (
        <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <textarea
            autoFocus
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write your note…"
            rows={3}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewColor(c.id)}
                  className={`w-4 h-4 rounded-full ${c.dot} ${newColor === c.id ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                />
              ))}
            </div>
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={addNote}
                disabled={saving || !newText.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
              </button>
              <button
                onClick={() => { setAdding(false); setNewText(''); }}
                className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 size={14} className="animate-spin" /> Loading notes…
        </div>
      ) : notes.length === 0 && !adding ? (
        <p className="text-sm text-slate-400 py-4 text-center">No notes yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <NoteItem key={n.annotation_id} note={n} onDelete={deleteNote} onUpdate={updateNote} />
          ))}
        </div>
      )}
    </div>
  );
}
