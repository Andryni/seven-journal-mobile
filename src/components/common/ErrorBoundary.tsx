import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { AlertTriangle } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.screenName ? `:${this.props.screenName}` : ''}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} screenName={this.props.screenName} />;
    }
    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void; screenName?: string }> = ({
  error,
  onReset,
  screenName,
}) => {
  // Inline theme to avoid hook issues in error state
  return (
    <View style={fallbackStyles.container}>
      <View style={fallbackStyles.iconWrap}>
        <AlertTriangle size={32} color="#FF4D4D" />
      </View>
      <Text style={fallbackStyles.title}>Oops ! Erreur</Text>
      {screenName && <Text style={fallbackStyles.screen}>{screenName}</Text>}
      <Text style={fallbackStyles.message}>
        {error?.message || 'Une erreur inattendue est survenue.'}
      </Text>
      <TouchableOpacity style={fallbackStyles.retryBtn} onPress={onReset} activeOpacity={0.8}>
        <Text style={fallbackStyles.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
};

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: withAlpha('#FF4D4D', 0.15), // raw hex on purpose: this boundary renders when the theme provider itself may have failed
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 17,
    fontFamily: 'JetBrainsMono_700Bold',
    marginBottom: 4,
  },
  screen: {
    color: '#FF9F1C',
    fontSize: 11,
    fontFamily: 'JetBrainsMono_400Regular',
    marginBottom: 8,
  },
  message: {
    color: '#A3A09B',
    fontSize: 12,
    // Hardcoded, like the rest of this file: the boundary renders when the
    // theme provider itself may have failed, so it cannot read from it.
    fontFamily: 'JetBrainsMono_400Regular',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#FF9F1C',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontFamily: 'JetBrainsMono_700Bold',
  },
});
