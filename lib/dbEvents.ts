/**
 * Mechanism to allow components to subscribe to database events.
 */
export class DatabaseEvents {
  private listeners: Set<Listener>;

  constructor() {
    this.listeners = new Set();
  }

  subscribe(listener: Listener[]): () => void {
    listener.forEach((listener) => this.listeners.add(listener));

    // Return unsubscribe function
    return () => {
      listener.forEach((listener) => this.listeners.delete(listener));
    };
  }

  emit(): void {
    console.log("emit");
    this.listeners.forEach((listener) => listener());
    console.log("triggered all listeners");
  }
}

type Listener = () => void;
