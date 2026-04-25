import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlgebraTilesCanvas } from './AlgebraTilesCanvas';

describe('AlgebraTilesCanvas', () => {
  it('renders correctly with valid JSON configuration', () => {
    const config = {
      expression: "x^2 - x + 1",
      tiles: [
        { type: "x^2", value: 1 },
        { type: "x", value: -1 },
        { type: "1", value: 1 }
      ]
    };
    
    render(<AlgebraTilesCanvas jsonConfig={config} />);
    
    // Test that the expression is displayed
    expect(screen.getByText('x^2 - x + 1')).toBeInTheDocument();
    
    // Test that tiles are rendered properly based on their title attribute
    const xSquaredTile = screen.getByTitle('x^2');
    expect(xSquaredTile).toBeInTheDocument();
    expect(xSquaredTile).toHaveClass('bg-blue-500'); // positive x^2
    
    const xTile = screen.getByTitle('-x');
    expect(xTile).toBeInTheDocument();
    expect(xTile).toHaveClass('bg-red-500'); // negative x
    
    const oneTile = screen.getByTitle('+1');
    expect(oneTile).toBeInTheDocument();
    expect(oneTile).toHaveClass('bg-yellow-400'); // positive 1
  });

  it('renders an error message for invalid JSON configuration', () => {
    render(<AlgebraTilesCanvas jsonConfig="invalid-json" />);
    expect(screen.getByText('Invalid algebra-tiles JSON')).toBeInTheDocument();
  });
});
