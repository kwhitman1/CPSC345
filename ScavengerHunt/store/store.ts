import { configureStore } from '@reduxjs/toolkit';
import huntsReducer from './huntsSlice';

export const store = configureStore({
  reducer: {
    hunts: huntsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
