import { useStudio } from '../context.js';
import type { ToolId } from '../types.js';
import { Icon, type IconName } from './icons.js';

const TOOL_ICONS: Record<ToolId, IconName> = {
  move: 'move',
  crop: 'crop',
  rotate: 'rotate',
  adjust: 'adjust',
  filter: 'filter',
  brush: 'brush',
  text: 'text',
  export: 'export',
};

export interface ToolbarProps {
  onReplace: () => void;
}

export function Toolbar({ onReplace }: ToolbarProps) {
  const api = useStudio();
  const { labels } = api;

  return (
    <nav className="ris-rail" aria-label="Tools">
      <div className="ris-rail__group">
        {api.tools.map((tool) => (
          <button
            key={tool}
            type="button"
            className={`ris-tool${api.tool === tool ? ' is-active' : ''}`}
            onClick={() => api.setTool(tool)}
            aria-pressed={api.tool === tool}
            aria-label={labels.tools[tool]}
            title={labels.tools[tool]}
          >
            <Icon name={TOOL_ICONS[tool]} size={20} />
            <span className="ris-tool__label">{labels.tools[tool]}</span>
          </button>
        ))}
      </div>

      <div className="ris-rail__group ris-rail__group--end">
        <button
          type="button"
          className="ris-tool ris-tool--compact"
          onClick={() => api.undo()}
          disabled={!api.canUndo}
          aria-label={labels.app.undo}
          title={`${labels.app.undo} (Ctrl+Z)`}
        >
          <Icon name="undo" size={18} />
        </button>
        <button
          type="button"
          className="ris-tool ris-tool--compact"
          onClick={() => api.redo()}
          disabled={!api.canRedo}
          aria-label={labels.app.redo}
          title={`${labels.app.redo} (Ctrl+Shift+Z)`}
        >
          <Icon name="redo" size={18} />
        </button>
        <button
          type="button"
          className="ris-tool ris-tool--compact"
          onClick={() => api.reset()}
          disabled={!api.dirty}
          aria-label={labels.app.reset}
          title={labels.app.reset}
        >
          <Icon name="reset" size={18} />
        </button>
        <button
          type="button"
          className="ris-tool ris-tool--compact"
          onClick={onReplace}
          aria-label={labels.app.chooseImage}
          title={labels.app.chooseImage}
        >
          <Icon name="image" size={18} />
        </button>
      </div>
    </nav>
  );
}
