import React, { useState } from 'react';
import { Input, Box, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const SearchInput = ({ onSearch }) => {
  const [inputValue, setInputValue] = useState('');

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch(inputValue);
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Input
        placeholder="Explore tx for satributes"
        value={inputValue}
        onChange={handleChange}
        sx={{
          fontWeight: 'bold',
          width: '60%',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '8px',
          '&:hover:not(.Mui-disabled):before': {
            borderBottom: 'none',
          },
          '&:before': {
            borderBottom: 'none',
          },
          '&:after': {
            borderBottom: 'none',
          },
        }}
        disableUnderline
      />
      <IconButton type="submit" aria-label="search" sx={{ marginLeft: '10px'}}>
        <SearchIcon fontSize="large" />
      </IconButton>
    </Box>
  );
};

export default SearchInput;
