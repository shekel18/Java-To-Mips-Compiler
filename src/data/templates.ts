export interface VirtualFile {
  name: string;
  content: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  files: VirtualFile[];
}

export const TEMPLATES: Template[] = [
  {
    id: "animal-dog",
    title: "Dog & Animal Inheritance",
    description: "Classic OOP inheritance with variable initializers, super constructor delegation, and dynamic/virtual method overriding.",
    files: [
      {
        name: "Animal.java",
        content: `class Animal {
    int age;
    
    Animal(int age) {
        this.age = age;
    }
    
    void makeSound() {
        System.out.println("Generic animal sound...");
    }
}`
      },
      {
        name: "Dog.java",
        content: `class Dog extends Animal {
    boolean isGoodBoy;
    
    Dog(int age, boolean isGoodBoy) {
        super(age); // Call super constructor!
        this.isGoodBoy = isGoodBoy;
    }
    
    @Override
    void makeSound() {
        System.out.println("Woof! Woof!"); // Overridden!
    }
    
    void wagTail() {
        System.out.println("Tail wagging happily...");
    }
}`
      },
      {
        name: "Main.java",
        content: `class Main {
    public static void main(String[] args) {
        // Create an instance of Dog store in Animal reference variable
        Animal myPet = new Dog(3, true);
        
        System.out.print("Pet age is: ");
        System.out.println(myPet.age);
        
        System.out.print("Dispatched voice: ");
        myPet.makeSound(); // Invokes Dog.makeSound via class vtable dispatch!
    }
}`
      }
    ]
  },
  {
    id: "shape-polygon",
    title: "Shape Polymorphism",
    description: "Features dynamic calculation interfaces showing how multi-level vtables resolve identical method dispatch offsets for rectangle and circle subclasses.",
    files: [
      {
        name: "Shape.java",
        content: `class Shape {
    void calculateArea() {
        System.out.println("Unknown area");
    }
}`
      },
      {
        name: "Rectangle.java",
        content: `class Rectangle extends Shape {
    int width;
    int height;
    
    Rectangle(int w, int h) {
        this.width = w;
        this.height = h;
    }
    
    @Override
    void calculateArea() {
        int area = this.width * this.height;
        System.out.print("Rectangle calculated area: ");
        System.out.println(area);
    }
}`
      },
      {
        name: "Circle.java",
        content: `class Circle extends Shape {
    int radius;
    
    Circle(int r) {
        this.radius = r;
    }
    
    @Override
    void calculateArea() {
        // Appoximate Pi = 3 for integer calculation in MARS
        int area = 3 * this.radius * this.radius;
        System.out.print("Circle (approx pi=3) area: ");
        System.out.println(area);
    }
}`
      },
      {
        name: "Main.java",
        content: `class Main {
    public static void main(String[] args) {
        Shape s1 = new Rectangle(6, 4);
        Shape s2 = new Circle(4);
        
        // Dynamic method calls resolve correct class at runtime
        s1.calculateArea();
        s2.calculateArea();
    }
}`
      }
    ]
  },
  {
    id: "linked-list",
    title: "Linked Nodes on Heap",
    description: "Heap allocation, pointers dereferencing, and while-loop pointer advancement. Illustrates heap structures directly in MIPS memory.",
    files: [
      {
        name: "Node.java",
        content: `class Node {
    int value;
    Node next;
    
    Node(int val) {
        this.value = val;
        this.next = null;
    }
}`
      },
      {
        name: "Main.java",
        content: `class Main {
    public static void main(String[] args) {
        Node first = new Node(10);
        Node second = new Node(20);
        Node third = new Node(30);
        
        first.next = second;
        second.next = third;
        
        Node current = first;
        while (current != null) {
            System.out.print("Node value: ");
            System.out.println(current.value);
            current = current.next; // Advance reference pointer
        }
    }
}`
      }
    ]
  },
  {
    id: "blank-code",
    title: "Blank Code Playpen",
    description: "A clean, empty template containing only Main.java with a main method to write custom code from scratch.",
    files: [
      {
        name: "Main.java",
        content: `class Main {
    public static void main(String[] args) {
        // Write your custom Java execution code here...
        System.out.println("Hello from blank playpen!");
    }
}`
      }
    ]
  }
];
