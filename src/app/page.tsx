'use client';

import { useState, useEffect, useCallback } from 'react';

interface WordChainResponse {
  words: string[];
}

type WordStatus = 'unsolved' | 'solving' | 'solved' | 'failed';

interface WordWithStatus {
  word: string;
  status: WordStatus;
  userInput: string[];
  currentIndex: number;
  hintsRevealed: number;
}

export default function Home() {
  const [words, setWords] = useState<WordWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [lives, setLives] = useState(5);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedWordIndex, setSelectedWordIndex] = useState(1);
  const [droppingHeart, setDroppingHeart] = useState<number | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [totalGuesses, setTotalGuesses] = useState(0);
  const [starAnimations, setStarAnimations] = useState<boolean[]>([]);

  // Fetch word chain on mount
  useEffect(() => {
    const fetchWordChain = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/wordchain?length=5');
        
        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit exceeded
            const data = await response.json();
            throw new Error(data.message || 'Too many requests. Please wait before trying again.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: WordChainResponse = await response.json();
        
        if (!data.words || !Array.isArray(data.words)) {
          throw new Error('Invalid response format');
        }

        // Initialize word data with status and user input tracking
        const wordsWithStatus: WordWithStatus[] = data.words.map((word, index) => {
          const isMiddleWord = index > 0 && index < data.words.length - 1;
          const userInput = Array(9).fill('');
          
          // For middle words, set the first letter as a hint
          if (isMiddleWord) {
            userInput[0] = word[0];
          }
          
          return {
            word: word.toUpperCase(),
            status: (index === 0 || index === data.words.length - 1) ? 'solved' : 'unsolved',
            userInput,
            currentIndex: isMiddleWord ? 1 : 0, // Start at position 1 for middle words (after the hint)
            hintsRevealed: isMiddleWord ? 1 : 0 // Start with first letter as hint for middle words
          };
        });

        setWords(wordsWithStatus);
        
        // Set the first unsolved word as selected
        const firstUnsolvedIndex = wordsWithStatus.findIndex(word => word.status === 'unsolved');
        if (firstUnsolvedIndex !== -1) {
          setSelectedWordIndex(firstUnsolvedIndex);
        }
        
        setIsTimerRunning(true);
      } catch (err) {
        console.error('Failed to fetch word chain:', err);
        setError(err instanceof Error ? err.message : 'Failed to load word chain');
      } finally {
        setLoading(false);
      }
    };

    fetchWordChain();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerRunning]);

  // Format timer as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate star rating
  const getStarRating = useCallback((): number => {
    if (timer <= 60 && lives >= 4) return 3; // Under 1 minute with 4+ lives
    if (timer <= 120 && lives >= 2) return 2; // Under 2 minutes with 2+ lives
    return 1; // Just solved it
  }, [timer, lives]);

  const playSound = useCallback((frequency: number, duration: number) => {
    try {
      const audioContext = new ((window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Fallback for browsers that don't support Web Audio API
      console.log('Sound not supported');
    }
  }, []);

  // Render stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex justify-center gap-[var(--space-sm)]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className={`
              text-fluid-xl sm:text-fluid-2xl transition-all duration-500 transform
              ${index < rating 
                ? starAnimations[index] 
                  ? 'text-yellow-400 scale-125 animate-pulse' 
                  : 'text-transparent scale-75'
                : 'text-gray-600/30 scale-75'
              }
            `}
          >
            ⭐
          </div>
        ))}
      </div>
    );
  };

  // Handle keyboard input
  const handleKeyPress = (key: string) => {
    if (selectedWordIndex < 1 || selectedWordIndex >= words.length - 1) return;
    
    const currentWord = words[selectedWordIndex];
    if (currentWord.status === 'solved' || currentWord.currentIndex >= 9) return;
    
    setWords(prev => prev.map((word, index) => {
      if (index === selectedWordIndex) {
        const newInput = [...word.userInput];
        newInput[word.currentIndex] = key.toUpperCase();
        return { 
          ...word, 
          userInput: newInput,
          currentIndex: word.currentIndex + 1,
          status: 'solving' as WordStatus
        };
      }
      return word;
    }));
  };

  // Handle backspace
  const handleBackspace = () => {
    if (selectedWordIndex < 1 || selectedWordIndex >= words.length - 1) return;
    
    const currentWord = words[selectedWordIndex];
    // Don't allow backspace past the hints (first letter + any revealed hints)
    const minIndex = Math.max(1, currentWord.hintsRevealed);
    if (currentWord.status === 'solved' || currentWord.currentIndex <= minIndex) return;
    
    setWords(prev => prev.map((word, index) => {
      if (index === selectedWordIndex) {
        const newInput = [...word.userInput];
        newInput[word.currentIndex - 1] = '';
        return { 
          ...word, 
          userInput: newInput,
          currentIndex: word.currentIndex - 1
        };
      }
      return word;
    }));
  };

  // Handle submit for specific word
  const handleSubmitWord = (index: number) => {
    if (index < 1 || index >= words.length - 1) return;
    
    const currentWord = words[index];
    const userWord = currentWord.userInput.join('').trim();
    const isCorrect = userWord === currentWord.word;
    
    // Increment total guesses
    setTotalGuesses(prev => prev + 1);
    
    if (isCorrect) {
      setWords(prev => prev.map((word, i) => {
        if (i === index) {
          return { ...word, status: 'solved' as WordStatus };
        }
        return word;
      }));
      
      if (index < words.length - 2) {
        setSelectedWordIndex(index + 1);
      }
    } else {
      // Trigger heart drop and screen shake
      setDroppingHeart(lives - 1);
      setScreenShake(true);
      
      setWords(prev => prev.map((word, i) => {
        if (i === index) {
          const newInput = Array(9).fill('');
          const newHintsRevealed = Math.min(word.hintsRevealed + 1, word.word.length); // Reveal one more letter as hint
          
          // Reset but keep the first letter hint and any newly revealed hints
          for (let j = 0; j < newHintsRevealed; j++) {
            newInput[j] = word.word[j];
          }
          
          return { 
            ...word, 
            status: 'failed' as WordStatus,
            userInput: newInput,
            currentIndex: newHintsRevealed, // Start after all hints
            hintsRevealed: newHintsRevealed
          };
        }
        return word;
      }));
      
      setLives(prev => prev - 1);
      
      // Reset animations and status after animation
      setTimeout(() => {
        setDroppingHeart(null);
        setScreenShake(false);
        setWords(prev => prev.map((word, i) => {
          if (i === index && word.status === 'failed') {
            return { ...word, status: 'unsolved' as WordStatus };
          }
          return word;
        }));
      }, 1000);
    }
  };

  // Check if game is complete
  const isGameComplete = words.every(word => word.status === 'solved');
  const isGameOver = lives <= 0;

  // Stop timer when game is complete
  useEffect(() => {
    if (isGameComplete && words.length > 0) {
      setIsTimerRunning(false);
    }
  }, [isGameComplete, words.length]);

  // Initialize star animations when game completes
  useEffect(() => {
    if (isGameComplete && words.length > 0) {
      const rating = getStarRating();
      if (rating > 0) {
        const animations = new Array(3).fill(false);
        setStarAnimations(animations);
        
        // Animate stars with delays and sound effects
        for (let i = 0; i < rating; i++) {
          setTimeout(() => {
            setStarAnimations(prev => {
              const newAnimations = [...prev];
              newAnimations[i] = true;
              return newAnimations;
            });
            // Play a pleasant sound for each star
            playSound(523.25 + (i * 130.81), 0.5); // C5, E5, G5 notes
          }, (i + 1) * 800); // 800ms delay between each star
        }
      }
    }
  }, [isGameComplete, words.length, getStarRating, playSound]);

  // Auto-refresh on game over after showing failure animation
  useEffect(() => {
    if (isGameOver) {
      setIsTimerRunning(false);
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000); // Show failure message for 3 seconds then refresh
      
      return () => clearTimeout(timer);
    }
  }, [isGameOver]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-4 py-6 sm:px-6 sm:py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto mb-4"></div>
          <p className="text-white/80 text-fluid-base">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isRateLimit = error.includes('Too many requests') || error.includes('try again');
    
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-pink-900 to-purple-900 px-4 py-6 sm:px-6 sm:py-8">
        <div className="text-center backdrop-blur-md bg-white/10 p-[var(--space-lg)] rounded-3xl max-w-xs sm:max-w-sm md:max-w-md mx-auto">
          <div className="text-fluid-2xl mb-4">
            {isRateLimit ? '⏳' : '❌'}
          </div>
          <h1 className="text-fluid-xl font-bold mb-4 text-white">
            {isRateLimit ? 'Please Wait' : 'Error'}
          </h1>
          <p className="text-red-300 mb-6 text-fluid-sm">{error}</p>
          {isRateLimit && (
            <p className="text-white/60 mb-4 text-fluid-xs">
              This helps protect the game from overuse. Thank you for your patience!
            </p>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="px-[var(--space-lg)] py-[var(--space-base)] bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all text-fluid-base"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isGameComplete && words.length > 0) {
    const starRating = getStarRating();
    
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 relative overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        {/* Floating celebration elements */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-fluid-lg animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              {['🎉', '✨', '🌟', '💫', '🎊'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
        
        <div className="text-center backdrop-blur-md bg-white/10 p-[var(--space-lg)] rounded-3xl relative z-10 max-w-xs sm:max-w-sm md:max-w-md w-full mx-auto">
          <div className="text-fluid-2xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-fluid-xl font-bold mb-4 text-white">Congratulations!</h1>
          
          {/* Star Rating */}
          <div className="flex justify-center mb-6">
            {renderStars(starRating)}
          </div>
          
          {/* Stats */}
          <div className="backdrop-blur-sm bg-white/5 p-[var(--space-base)] rounded-2xl mb-6 space-y-[var(--space-sm)]">
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-fluid-sm">Time:</span>
              <span className="font-mono text-white font-bold text-fluid-sm">{formatTime(timer)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-fluid-sm">Total Guesses:</span>
              <span className="font-mono text-white font-bold text-fluid-sm">{totalGuesses}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-fluid-sm">Lives Remaining:</span>
              <span className="font-mono text-white font-bold text-fluid-sm">{lives}</span>
            </div>
          </div>
          
          {/* Performance Message */}
          <p className="text-white/80 mb-6 text-fluid-xs">
            {starRating === 3 && "Amazing! Lightning fast with minimal mistakes!"}
            {starRating === 2 && "Great job! Quick thinking and good accuracy!"}
            {starRating === 1 && "Well done! You solved the puzzle!"}
          </p>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-[var(--space-lg)] py-[var(--space-base)] bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all transform hover:scale-105 font-semibold text-fluid-base"
          >
            Continue to Next Puzzle
          </button>
        </div>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-pink-900 to-purple-900 animate-pulse px-4 py-6 sm:px-6 sm:py-8">
        <div className="text-center backdrop-blur-md bg-white/10 p-[var(--space-lg)] rounded-3xl animate-bounce">
          <div className="text-fluid-2xl mb-4 animate-spin">💀</div>
          <h1 className="text-fluid-xl font-bold mb-2 text-white animate-pulse">Game Over!</h1>
          <p className="text-white/80 mb-4 text-fluid-base">You ran out of lives!</p>
          <div className="flex items-center justify-center gap-[var(--space-sm)] mb-4">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-white/60 text-fluid-xs">Starting new game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 ${screenShake ? 'animate-shake' : ''}`}>
      {/* Main container with responsive padding and max-width */}
      <div className="h-full w-full max-w-screen-lg mx-auto px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-12 lg:py-12">
        <div className="h-full grid grid-rows-[auto_auto_1fr_auto] gap-2 sm:gap-3 md:gap-4">
          {/* Header Row - Auto height */}
          <div className="flex items-center justify-between">
            <h1 className="text-fluid-lg sm:text-fluid-xl font-bold text-white">Word Chain</h1>
            <div className="backdrop-blur-md bg-white/10 px-2 sm:px-3 py-1 rounded-full flex items-center gap-1 sm:gap-2">
              <span className="text-yellow-300 text-fluid-sm">⏱️</span>
              <span className="font-mono text-white text-fluid-sm">{formatTime(timer)}</span>
            </div>
          </div>

          {/* Lives Row - Auto height */}
          <div className="flex justify-center">
            <div className="flex gap-[var(--space-xs)] sm:gap-[var(--space-sm)]">
              {Array.from({ length: 5 }).map((_, index) => (
                <div 
                  key={index}
                  className={`
                    text-fluid-lg sm:text-fluid-xl transition-all duration-300 relative
                    ${droppingHeart === index ? 'animate-fall' : ''}
                  `}
                >
                  {index < lives ? (
                    <span className="text-red-500">❤️</span>
                  ) : (
                    <span className="text-gray-600/50">🖤</span>
                  )}
                  {droppingHeart === index && (
                    <div className="absolute top-0 left-0 text-fluid-lg sm:text-fluid-xl text-red-500 animate-pulse opacity-50">
                      💔
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Word Grid Row - Flexible height with aspect ratio container */}
          <div className="flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
              <div className="backdrop-blur-md bg-white/10 rounded-2xl shadow-2xl p-[var(--space-base)] sm:p-[var(--space-lg)]">
                <div className="space-y-[var(--space-sm)] sm:space-y-[var(--space-base)]">
                  {words.map((wordData, wordIndex) => (
                    <div 
                      key={wordIndex} 
                      className={`transition-all duration-300 ${
                        wordData.status === 'failed' ? 'animate-shake' : ''
                      }`}
                      onClick={() => setSelectedWordIndex(wordIndex)}
                    >
                      <div className="flex items-center gap-[var(--space-sm)]">
                        <div 
                          className="grid flex-1"
                          style={{ 
                            gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
                            gap: 'var(--space-xs)'
                          }}
                        >
                          {Array.from({ length: 9 }).map((_, letterIndex) => {
                            const isMiddleWord = wordIndex > 0 && wordIndex < words.length - 1;
                            
                            let letter = '';
                            let isCurrentPosition = false;
                            let isLockedFirstLetter = false;
                            let isHintLetter = false;
                            
                            if (wordData.status === 'solved') {
                              letter = wordData.word[letterIndex] || '';
                            } else if (isMiddleWord && letterIndex === 0) {
                              letter = wordData.word[0];
                              isLockedFirstLetter = true;
                            } else if (isMiddleWord && letterIndex > 0 && letterIndex < wordData.hintsRevealed) {
                              letter = wordData.word[letterIndex];
                              isHintLetter = true;
                            } else if (isMiddleWord) {
                              letter = wordData.userInput[letterIndex] || '';
                              isCurrentPosition = letterIndex === wordData.currentIndex;
                            } else {
                              letter = wordData.word[letterIndex] || '';
                            }
                            
                            const hasLetter = letter !== '';
                            const isEmptyInSolvedWord = wordData.status === 'solved' && !wordData.word[letterIndex];
                            
                            return (
                              <div
                                key={letterIndex}
                                className={`
                                  aspect-square rounded-md flex items-center justify-center font-bold 
                                  text-fluid-xs sm:text-fluid-sm transition-all duration-300 transform
                                  ${hasLetter && !isEmptyInSolvedWord ? 'scale-100' : 'scale-95'}
                                  ${isEmptyInSolvedWord 
                                    ? 'opacity-0' 
                                    : wordData.status === 'solved' && hasLetter
                                    ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg' 
                                    : wordData.status === 'failed'
                                    ? 'bg-gradient-to-br from-red-400 to-pink-500 text-white shadow-lg'
                                    : isLockedFirstLetter
                                    ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-lg border-2 border-blue-300'
                                    : isHintLetter
                                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg animate-pulse'
                                    : isCurrentPosition
                                    ? 'bg-white/30 backdrop-blur-sm shadow-xl scale-110 border-2 border-white/50'
                                    : hasLetter
                                    ? 'bg-white/20 backdrop-blur-sm text-white shadow-md'
                                    : 'bg-white/5 backdrop-blur-sm'
                                  }
                                `}
                              >
                                {letter}
                              </div>
                            );
                          })}
                        </div>
                        {wordIndex > 0 && wordIndex < words.length - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitWord(wordIndex);
                            }}
                            disabled={wordData.status === 'solved' || wordData.currentIndex === 0}
                            className={`
                              px-[var(--space-sm)] py-[var(--space-xs)] rounded-lg font-semibold 
                              text-fluid-xs sm:text-fluid-sm transition-all whitespace-nowrap flex-shrink-0
                              ${wordData.status === 'solved'
                                ? 'bg-green-500 text-white cursor-not-allowed'
                                : wordData.currentIndex > 0
                                ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 hover:scale-105'
                                : 'bg-white/5 backdrop-blur-sm text-white/30 cursor-not-allowed'
                              }
                            `}
                          >
                            {wordData.status === 'solved' ? '✓' : 'GO'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard Row - Auto height with fluid grid */}
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-[var(--space-sm)] sm:p-[var(--space-base)]">
            <div className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto space-y-[var(--space-xs)]">
              {/* Top row - QWERTYUIOP */}
              <div 
                className="grid"
                style={{ 
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gap: 'var(--space-xs)'
                }}
              >
                {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(key => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="aspect-square max-h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-fluid-xs sm:text-fluid-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    {key}
                  </button>
                ))}
              </div>
              
              {/* Middle row - ASDFGHJKL */}
              <div className="px-[5%] sm:px-[7%]">
                <div 
                  className="grid"
                  style={{ 
                    gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
                    gap: 'var(--space-xs)'
                  }}
                >
                  {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(key => (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className="aspect-square max-h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-fluid-xs sm:text-fluid-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Bottom row - ZXCVBNM + Backspace */}
              <div className="px-[10%] sm:px-[12%]">
                <div 
                  className="grid"
                  style={{ 
                    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                    gap: 'var(--space-xs)'
                  }}
                >
                  {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(key => (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className="aspect-square max-h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-fluid-xs sm:text-fluid-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                    >
                      {key}
                    </button>
                  ))}
                  <button
                    onClick={handleBackspace}
                    className="aspect-square max-h-12 bg-red-500/50 backdrop-blur-sm hover:bg-red-500/70 rounded-md font-bold text-white text-fluid-xs sm:text-fluid-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    ←
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
