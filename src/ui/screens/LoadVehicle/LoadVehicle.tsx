import { useLiveQuery } from 'dexie-react-hooks';
import { Package, Truck } from 'lucide-react';
import { listStops } from '../../../data/repos';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import { Screen } from '../../common/ui';
import { vanPosition } from '../RouteScreen/StopCard';
import './LoadVehicle.css';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * "Carica veicolo": le fermate da fare in ordine inverso — l'ultima consegna si carica per prima, in fondo al furgone,
 * così i pacchi delle prime fermate restano a portata di mano.
 */
export function LoadVehicle(props: { routeId: string; onClose: () => void }) {
  const stops = useLiveQuery(() => listStops(props.routeId), [props.routeId]);
  if (!stops) return null;
  const toLoad = stops
    .filter((s) => s.outcome === 'pending')
    .sort((a, b) => (b.sequence ?? b.originalIndex) - (a.sequence ?? a.originalIndex));
  const packages = toLoad.reduce((n, s) => n + s.packages, 0);

  return (
    <Screen title="Carica veicolo" onClose={props.onClose}>
      <div className="load-intro">
        <Truck size={22} aria-hidden="true" />
        <span>
          <strong>{packages} {packages === 1 ? 'pacco' : 'pacchi'} da caricare</strong>
          <span className="row-sub">Dall'alto in basso: i primi vanno in fondo al furgone, gli ultimi vicino alla porta.</span>
        </span>
      </div>
      <ol className="stop-list" aria-label="Ordine di carico">
        {toLoad.map((s, i) => (
          <li key={s.id} className="tl-row load-row">
            <span className="tl-left">
              <span className="tl-num num">{two(i + 1)}</span>
            </span>
            <span className="grow">
              <span className="tl-title">{formatAddressLine(s.address)}</span>
              <span className="tl-sub">
                {formatAddressCity(s.address)}
                {s.packages > 1 && (
                  <span className="tl-pkgs">
                    <Package size={13} aria-hidden="true" /> {s.packages} pacchi
                  </span>
                )}
              </span>
              {vanPosition(s.findPackage) && <span className="load-pos">{vanPosition(s.findPackage)}</span>}
            </span>
            <span className="tl-end">
              <span className="tl-chip num">ID {s.displayId}</span>
            </span>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
