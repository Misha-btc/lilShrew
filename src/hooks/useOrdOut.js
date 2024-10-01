import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'https://mainnet.sandshrew.io/v1/8f32211e11c25c2f0b5084e41970347d';

export const useOrdOut = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchOrdOut = useCallback(async (utxo) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(API_URL, {
        jsonrpc: '2.0',
        id: 1,
        method: 'ord_output',
        params: [utxo]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setData(response.data);
    } catch (err) {
      setError(err.message || 'Произошла ошибка при запросе данных');
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchOrdOut, loading, error, data };
};
