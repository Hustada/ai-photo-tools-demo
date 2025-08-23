// © 2025 Mark Hustad — MIT License
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import AboutPage from '../AboutPage';

describe('AboutPage', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render the About page', () => {
    renderWithRouter(<AboutPage />);
    
    expect(screen.getByText('Technical Documentation')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Photo Intelligence')).toBeInTheDocument();
  });

  it('should display AI Tag Suggestion Pipeline section', () => {
    renderWithRouter(<AboutPage />);
    
    expect(screen.getByText('AI Tag Suggestion Pipeline')).toBeInTheDocument();
    expect(screen.getByText('OpenAI GPT-4 Vision')).toBeInTheDocument();
    expect(screen.getByText('Google Cloud Vision')).toBeInTheDocument();
  });

  it('should display Burst Detection Pipeline section', () => {
    renderWithRouter(<AboutPage />);
    
    expect(screen.getByText('Burst Detection & Quality Analysis Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Anthropic Claude 3.5 Sonnet')).toBeInTheDocument();
  });

  it('should display Technical Architecture section', () => {
    renderWithRouter(<AboutPage />);
    
    expect(screen.getByText('Technical Architecture')).toBeInTheDocument();
    expect(screen.getByText('Frontend Stack')).toBeInTheDocument();
    expect(screen.getByText('AI/ML Services')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
  });

  it('should display Performance section', () => {
    renderWithRouter(<AboutPage />);
    
    expect(screen.getByText('Performance Characteristics')).toBeInTheDocument();
    expect(screen.getByText('Response Times')).toBeInTheDocument();
    expect(screen.getByText('Accuracy Metrics')).toBeInTheDocument();
  });

  it('should have a back to app link', () => {
    renderWithRouter(<AboutPage />);
    
    const backLink = screen.getByText('Back to App');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });
});