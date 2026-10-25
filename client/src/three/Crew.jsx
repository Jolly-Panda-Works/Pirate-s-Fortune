import Sailor from './Sailor.jsx';
import { CrewMember } from './Synty.jsx';

/** A seated crew member: the Synty model, or the procedural sailor while it loads. */
export default function Crew(props) {
  return <CrewMember {...props} fallback={<Sailor {...props} />} />;
}
