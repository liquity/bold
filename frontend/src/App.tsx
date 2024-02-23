import { Web3Provider } from ":src/context/web3";
import { Home } from ":src/screens/Home";
import { ThemeProvider } from ":src/theme";

export default function App() {
  return (
    <Web3Provider>
      <ThemeProvider>
        <Home />
      </ThemeProvider>
    </Web3Provider>
  );
}
