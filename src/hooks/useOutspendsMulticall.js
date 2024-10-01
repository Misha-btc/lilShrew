import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'https://mainnet.sandshrew.io/v1/8f32211e11c25c2f0b5084e41970347d';

export const useOutspendsMulticall = () => {


  const fetchOutspendsMulticall = useCallback(async (txArray) => {

    try {

      const response = await axios.post(API_URL, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sandshrew_multicall',
        params: txArray
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (err) {
      console.log(err.message || 'Произошла ошибка при запросе данных');
    }
  }, []);

  return { fetchOutspendsMulticall };
};
