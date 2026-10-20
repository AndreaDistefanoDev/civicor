import { useState } from 'react';
import { createRoute, weekdayName } from '../../../data/repos';
import { addDays, shortDate } from '../../dates';
import { Screen } from '../../common/ui';
import './CreateRoute.css';

type DateChoice = 'today' | 'tomorrow' | 'custom';

export function CreateRoute(props: { today: string; onCreated: (routeId: string) => void; onClose: () => void }) {
  const tomorrow = addDays(props.today, 1);
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<DateChoice>('today');
  const [custom, setCustom] = useState(addDays(props.today, 2));
  const date = choice === 'today' ? props.today : choice === 'tomorrow' ? tomorrow : custom;

  const confirm = async () => {
    const route = await createRoute({ name, date });
    props.onCreated(route.id);
  };

  const option = (value: DateChoice, label: string, sub: string) => (
    <label className="date-option">
      <input type="radio" name="route-date" checked={choice === value} onChange={() => setChoice(value)} />
      <span className="grow">
        {label} <span className="muted">{sub}</span>
      </span>
    </label>
  );

  return (
    <Screen
      title="Crea percorso"
      onClose={props.onClose}
      footer={
        <button className="btn-primary" onClick={confirm}>
          Conferma
        </button>
      }
    >
      <label className="field">
        <span>Nome percorso (facoltativo)</span>
        <input value={name} placeholder={weekdayName(date)} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="section-title">Seleziona data</div>
      <div className="date-options" role="radiogroup" aria-label="Seleziona data">
        {option('today', 'Oggi', `${weekdayName(props.today).slice(0, 3)} ${shortDate(props.today)}`)}
        {option('tomorrow', 'Domani', `${weekdayName(tomorrow).slice(0, 3)} ${shortDate(tomorrow)}`)}
        {option('custom', 'Scegli una data', choice === 'custom' ? shortDate(custom) : '')}
      </div>
      {choice === 'custom' && (
        <label className="field">
          <span>Data</span>
          <input type="date" value={custom} min={props.today} onChange={(e) => e.target.value && setCustom(e.target.value)} />
        </label>
      )}
    </Screen>
  );
}
