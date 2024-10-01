import { useOutspends } from '../hooks/useOutspendsMulticall';
import { useAssembler } from '../hooks/useAssembler';

function Result() {
  const { fetchAssembler, MulticallData } = useAssembler();

  const handleFetch = () => {
      fetchAssembler('59184862401dee8e274aeacc912fd484cffa5167f10e385b2ca6d48fb3dc553f');
  };

  return (
    <div>
      <button onClick={handleFetch}>Получить данные</button>
      {MulticallData && <pre>{JSON.stringify(MulticallData, null, 2)}</pre>}
    </div>
  );
}

export default Result;
