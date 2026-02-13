import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './HomePage'
import ReqToDSL from './ReqToDSL'
import ReqToDSL_B from './ReqToDSL_B'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/req-to-dsl" element={<ReqToDSL />} />
        <Route path="/req-to-dsl-b" element={<ReqToDSL_B />} />
      </Routes>
    </BrowserRouter>
  )
}
