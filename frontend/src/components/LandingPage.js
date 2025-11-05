import React from 'react';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  Zap, 
  Sparkles, 
  Target, 
  Award 
} from 'lucide-react';

const LandingPage = ({ onLogin }) => {

  // ✅ Just trigger the parent login handler
  const handleGoogleLogin = () => {
    if (onLogin) onLogin();
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="logo">
          <span className="logo-emoji">🎓</span>
          Study Mate
        </div>
        <button className="login-btn" onClick={handleGoogleLogin}>
          <Users size={18} />
          Sign in with Google
        </button>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1>
              Your <span className="student-focused">Student-First</span><br />
              <span className="highlight">Study Companion</span> 🚀
            </h1>
            <p>
              Join thousands of students who've transformed their learning with AI-powered 
              study tools, smart reminders, and progress tracking designed specifically for 
              students like you!
            </p>
            <div className="cta-buttons">
              <button className="cta-btn" onClick={handleGoogleLogin}>
                <Sparkles size={20} />
                Start Your Journey
              </button>
              <button className="cta-btn secondary">
                <Target size={20} />
                See How It Works
              </button>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="student-images">
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c" 
                alt="Students collaborating with laptops"
                className="student-image large"
              />
              <img 
                src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846" 
                alt="Diverse group of students"
                className="student-image"
              />
              <img 
                src="https://images.pexels.com/photos/6147369/pexels-photo-6147369.jpeg" 
                alt="Students in modern classroom"
                className="student-image"
              />
            </div>
            <div className="floating-elements">
              <div className="floating-element">🎯</div>
              <div className="floating-element">📚</div>
              <div className="floating-element">⚡</div>
              <div className="floating-element">🏆</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-preview">
        <h2 className="features-title">Built for Student Success 🌟</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>Smart Study Manager</h3>
            <p>Upload notes, organize materials, and get AI-powered insights tailored to your learning style</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Personalized Quizzes</h3>
            <p>Generate custom quizzes from your notes and track your progress like never before</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Focus Timer</h3>
            <p>Stay on track with Pomodoro timers and study sessions designed to maximize your productivity</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Progress Analytics</h3>
            <p>Visualize your learning journey with detailed stats, streaks, and achievement tracking</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI Study Buddy</h3>
            <p>Get instant help with homework, explanations, and study guidance 24/7</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⏰</div>
            <h3>Smart Reminders</h3>
            <p>Never miss deadlines with intelligent scheduling and personalized study notifications</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
