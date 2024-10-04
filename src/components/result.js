import { useAssembler } from '../hooks/save';
function Result() {

  const { fetchAssembler } = useAssembler();

  const handleFetch = () => {
      fetchAssembler('59184862401dee8e274aeacc912fd484cffa5167f10e385b2ca6d48fb3dc553f');
  };

  return (
    <div>
      <button onClick={handleFetch}>Получить данные</button>
    </div>
  );
}

export default Result;
