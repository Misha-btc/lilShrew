import './App.css';
import { AppBar, Toolbar, Typography, Container, Box} from '@mui/material';
import SearchInput from './components/SearchInput';
import Result from './components/result';

function App() {
  return (
    <div className="App">
      <AppBar position="static" sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
        <Toolbar>
          <Typography variant="h4" fontWeight="bold">
            lilShrew
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <SearchInput />
        </Box>
        <Result />
      </Container>
    </div>
  );
}

export default App;
