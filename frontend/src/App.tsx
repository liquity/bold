import { Web3Provider } from ":src/context/web3";
import { Home } from ":src/screens/Home";

function App() {
  return (
    <Web3Provider>
      <Home />
    </Web3Provider>
  );
}

export default App;
