'use client';

import { useState, useEffect } from 'react';

interface WordChainResponse {
  words: string[];
}

type WordStatus = 'unsolved' | 'solving' | 'solved' | 'failed';

interface WordWithStatus {
  word: string;
  status: WordStatus;
  userInput: string[];
  currentIndex: number;
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
          throw new Error('Failed to fetch word chain');
        }
        
        const data: WordChainResponse = await response.json();
        console.log('🎯 Word Chain for Testing:', data.words);
        
        const wordsWithStatus: WordWithStatus[] = data.words.map((word, index) => {
          const isMiddleWord = index > 0 && index < data.words.length - 1;
          const userInput = Array(12).fill('');
          
          // Pre-fill first letter for middle words (the hint)
          if (isMiddleWord) {
            userInput[0] = word.toUpperCase()[0];
          }
          
          return {
            word: word.toUpperCase(),
            status: index === 0 || index === data.words.length - 1 ? 'solved' : 'unsolved',
            userInput,
            currentIndex: isMiddleWord ? 1 : 0 // Start at position 1 for middle words
          };
        });
        
        console.log('📝 Words with Status:', wordsWithStatus.map(w => ({ word: w.word, status: w.status })));
        
        setWords(wordsWithStatus);
        setIsTimerRunning(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
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
  const getStarRating = (): number => {
    if (timer <= 60 && lives >= 4) return 3; // Under 1 minute with 4+ lives
    if (timer <= 120 && lives >= 2) return 2; // Under 2 minutes with 2+ lives
    return 1; // Just solved it
  };

  const playSound = (frequency: number, duration: number) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch (error) {
      // Fallback for browsers that don't support Web Audio API
      console.log('Sound not supported');
    }
  };

  // Render stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex justify-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className={`
              text-3xl md:text-4xl transition-all duration-500 transform
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
    if (currentWord.status === 'solved' || currentWord.currentIndex >= 12) return;
    
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
    // Don't allow backspace past position 1 (since position 0 is the locked first letter)
    if (currentWord.status === 'solved' || currentWord.currentIndex <= 1) return;
    
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
          const newInput = Array(12).fill('');
          // Reset but keep the first letter hint
          newInput[0] = word.word[0];
          
          return { 
            ...word, 
            status: 'failed' as WordStatus,
            userInput: newInput,
            currentIndex: 1 // Reset to position 1 (after the locked first letter)
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
  }, [isGameComplete]);

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
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto mb-4"></div>
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-pink-900 to-purple-900">
        <div className="text-center backdrop-blur-md bg-white/10 p-8 rounded-3xl">
          <p className="text-red-300 mb-4">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all"
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
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 relative overflow-hidden">
        {/* Floating celebration elements */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-bounce"
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
        
        <div className="text-center backdrop-blur-md bg-white/10 p-6 md:p-8 rounded-3xl relative z-10 max-w-sm md:max-w-md w-full mx-4">
          <div className="text-5xl md:text-6xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-2xl md:text-3xl font-bold mb-4 text-white">Congratulations!</h1>
          
          {/* Star Rating */}
          <div className="flex justify-center mb-6">
            {renderStars(starRating)}
          </div>
          
          {/* Stats */}
          <div className="backdrop-blur-sm bg-white/5 p-4 rounded-2xl mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-sm md:text-base">Time:</span>
              <span className="font-mono text-white font-bold text-sm md:text-base">{formatTime(timer)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-sm md:text-base">Total Guesses:</span>
              <span className="font-mono text-white font-bold text-sm md:text-base">{totalGuesses}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-sm md:text-base">Lives Remaining:</span>
              <span className="font-mono text-white font-bold text-sm md:text-base">{lives}</span>
            </div>
          </div>
          
          {/* Performance Message */}
          <p className="text-white/80 mb-6 text-xs md:text-sm">
            {starRating === 3 && "Amazing! Lightning fast with minimal mistakes!"}
            {starRating === 2 && "Great job! Quick thinking and good accuracy!"}
            {starRating === 1 && "Well done! You solved the puzzle!"}
          </p>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-6 md:px-8 py-2 md:py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all transform hover:scale-105 font-semibold text-sm md:text-base"
          >
            Continue to Next Puzzle
          </button>
        </div>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-pink-900 to-purple-900 animate-pulse">
        <div className="text-center backdrop-blur-md bg-white/10 p-6 md:p-8 rounded-3xl animate-bounce">
          <div className="text-5xl md:text-6xl mb-4 animate-spin">💀</div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white animate-pulse">Game Over!</h1>
          <p className="text-white/80 mb-4 text-sm md:text-base">You ran out of lives!</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-white/60 text-xs md:text-sm">Starting new game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-3 md:p-4 ${screenShake ? 'animate-shake' : ''}`}>
      {/* Header - Fixed height */}
      <div className="flex items-center justify-between mb-2 md:mb-3 flex-shrink-0">
        <h1 className="text-lg md:text-xl font-bold text-white">Word Chain</h1>
        <div className="backdrop-blur-md bg-white/10 px-3 py-1 rounded-full flex items-center gap-2">
          <span className="text-yellow-300 text-sm">⏱️</span>
          <span className="font-mono text-white text-sm">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Lives Display - Fixed height, moved higher */}
      <div className="flex justify-center mb-4 md:mb-6 flex-shrink-0">
        <div className="flex gap-1 md:gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div 
              key={index}
              className={`
                text-xl md:text-2xl transition-all duration-300 relative
                ${index < lives ? 'text-red-500' : 'text-gray-600/30'}
                ${droppingHeart === index ? 'animate-bounce' : ''}
              `}
            >
              ❤️
              {droppingHeart === index && (
                <div className="absolute top-0 left-0 text-xl md:text-2xl text-red-500 animate-pulse opacity-50">
                  💔
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Word Grid - Takes remaining space but leaves room for keyboard */}
      <div className="flex-1 flex flex-col justify-center items-center min-h-0 mb-4 md:mb-6">
        <div className="backdrop-blur-md bg-white/10 p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-2xl max-w-full md:max-w-2xl w-full">
          {words.map((wordData, wordIndex) => (
            <div 
              key={wordIndex} 
              className={`mb-2 md:mb-3 last:mb-0 transition-all duration-300 ${
                wordData.status === 'failed' ? 'animate-shake' : ''
              }`}
              onClick={() => setSelectedWordIndex(wordIndex)}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="grid grid-cols-12 gap-1 flex-1">
                  {Array.from({ length: 12 }).map((_, letterIndex) => {
                    const isMiddleWord = wordIndex > 0 && wordIndex < words.length - 1;
                    
                    let letter = '';
                    let isCurrentPosition = false;
                    let isLockedFirstLetter = false;
                    
                    if (wordData.status === 'solved') {
                      // Show the actual word
                      letter = wordData.word[letterIndex] || '';
                    } else if (isMiddleWord && letterIndex === 0) {
                      // First letter is always shown as a hint and locked
                      letter = wordData.word[0];
                      isLockedFirstLetter = true;
                    } else if (isMiddleWord) {
                      // Show user input for middle words
                      letter = wordData.userInput[letterIndex] || '';
                      isCurrentPosition = letterIndex === wordData.currentIndex;
                    } else {
                      // First and last words show the complete word
                      letter = wordData.word[letterIndex] || '';
                    }
                    
                    const hasLetter = letter !== '';
                    const isEmptyInSolvedWord = wordData.status === 'solved' && !wordData.word[letterIndex];
                    
                    return (
                      <div
                        key={letterIndex}
                        className={`
                          aspect-square rounded-md flex items-center justify-center font-bold text-xs md:text-sm
                          transition-all duration-300 transform
                          ${hasLetter && !isEmptyInSolvedWord ? 'scale-100' : 'scale-95'}
                          ${isEmptyInSolvedWord 
                            ? 'opacity-0' 
                            : wordData.status === 'solved' && hasLetter
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg' 
                            : wordData.status === 'failed'
                            ? 'bg-gradient-to-br from-red-400 to-pink-500 text-white shadow-lg'
                            : isLockedFirstLetter
                            ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-lg border-2 border-blue-300'
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
                      px-2 md:px-3 py-1 md:py-2 rounded-lg font-semibold text-xs md:text-sm transition-all
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

      {/* Keyboard - Fixed height, smaller on desktop */}
      <div className="backdrop-blur-md bg-white/10 p-2 md:p-3 rounded-2xl md:rounded-3xl mb-6 md:mb-0 flex-shrink-0">
        <div className="grid grid-cols-10 gap-1 max-w-full md:max-w-xl mx-auto">
          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(key => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className="h-10 md:h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
            >
              {key}
            </button>
          ))}
          <div className="col-span-10 grid grid-cols-9 gap-1 mt-1">
            {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="h-10 md:h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="col-span-10 grid grid-cols-8 gap-1 mt-1">
            {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="h-10 md:h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-md font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
              >
                {key}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="h-10 md:h-10 bg-red-500/50 backdrop-blur-sm hover:bg-red-500/70 rounded-md font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
            >
              ←
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
