import { GameCanvas } from './rendering/GameCanvas'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-kicker">Active Burger 4</p>
        <h1>Prototype Arena</h1>
      </header>
      <GameCanvas />
    </main>
  )
}

export default App
