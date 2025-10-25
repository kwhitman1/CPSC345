import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Hunt = { id: string; name: string; userId: string; createdAt?: any };

const initialState = {
  items: [] as Hunt[],
  loading: false,
};

const huntsSlice = createSlice({
  name: 'hunts',
  initialState,
  reducers: {
    setHunts(state, action: PayloadAction<Hunt[]>) {
      state.items = action.payload;
    },
    addHunt(state, action: PayloadAction<Hunt>) {
      state.items.unshift(action.payload);
    },
    updateHunt(state, action: PayloadAction<Hunt>) {
      state.items = state.items.map((h) => (h.id === action.payload.id ? action.payload : h));
    },
    removeHunt(state, action: PayloadAction<string>) {
      state.items = state.items.filter((h) => h.id !== action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setHunts, addHunt, updateHunt, removeHunt, setLoading } = huntsSlice.actions;
export default huntsSlice.reducer;
