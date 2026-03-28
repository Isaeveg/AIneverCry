import { useState } from 'react'
import './App.css'

interface TopCategory {
  id: number;
  title: string;
  icon: string;
  active?: boolean;
}

interface GridItem {
  id: number;
  title: string;
  desc: string;
  type: 'small' | 'large';
  icon: string;
}

function App() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false)

  const topCategories: TopCategory[] = [
    { id: 1, title: 'DESIGN', icon: 'design', active: true },
    { id: 2, title: 'DEVELOPMENT', icon: 'dev' },
    { id: 3, title: 'MARKETING', icon: 'marketing' }
  ]

  const gridLeft: GridItem[] = [
    { id: 1, title: 'DESIGN DESIGN', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'monitor' },
    { id: 2, title: 'DEVELOPMENT MENT', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'settings' },
    { id: 3, title: 'DESIGN DESIGN', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'monitor' }
  ]

  const gridMiddle: GridItem[] = [
    { id: 4, title: 'WEB DESIGN', desc: 'Creating websites and web applications of any complexity, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', type: 'large', icon: 'globe' },
    { id: 5, title: 'DEVELOPMENT SMENT', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'code' }
  ]

  const gridRight: GridItem[] = [
    { id: 6, title: 'FEATURE LABOURS', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'speaker' },
    { id: 7, title: 'MARKETING', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'chart' },
    { id: 8, title: 'MARKETING', desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', type: 'small', icon: 'speaker' }
  ]

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🌐</span> WEBPRO
        </div>
        
        <nav className={`nav ${menuOpen ? 'active' : ''}`}>
          <a href="#services" className="active-link">SERVICES</a>
          <a href="#works">WORKS</a>
          <a href="#about">ABOUT</a>
          <a href="#blog">BLOG</a>
          <a href="#pricing">PRICING</a>
        </nav>

        <button className="contact-btn desktop-only">CONTACT</button>
        
        <button className="burger mobile-only" onClick={() => setMenuOpen(!menuOpen)}>
          <div className="burger-line"></div>
          <div className="burger-line"></div>
          <div className="burger-line"></div>
        </button>
      </header>

      <main>
        <section className="hero">
          <h1>Professional Web Services</h1>
          <p className="hero-desc">Creating websites and web applications of any complexity</p>
          <p className="subtitle">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
          <button className="primary-btn">ORDER PROJECT</button>
        </section>

        <section className="services-section">
          <div className="top-categories">
            {topCategories.map(cat => (
              <div key={cat.id} className={`category-circle ${cat.active ? 'active' : ''}`}>
                <div className="circle-icon"></div>
                <span>{cat.title}</span>
              </div>
            ))}
          </div>

          <div className="bento-grid">
            <div className="grid-column">
              {gridLeft.map(item => (
                <div key={item.id} className="grid-card small-card">
                  <div className="card-icon"></div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid-column middle-column">
              {gridMiddle.map(item => (
                <div key={item.id} className={`grid-card ${item.type === 'large' ? 'large-card' : 'small-card'}`}>
                  <div className={`card-icon ${item.type === 'large' ? 'large-icon' : ''}`}></div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                  {item.type === 'large' && <button className="primary-btn small">ORDER NOW</button>}
                </div>
              ))}
            </div>

            <div className="grid-column">
              {gridRight.map(item => (
                <div key={item.id} className="grid-card small-card">
                  <div className="card-icon"></div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App