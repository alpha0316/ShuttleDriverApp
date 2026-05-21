export interface OrderItem {
  item: string;
  quantity: number;
  price: number;
}

export interface CustomerLocation {
  lat: number;
  lng: number;
  name: string;
}

export interface VendorLocation {
  lat: number;
  lng: number;
  name: string;
}

export interface MockOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerLocation: CustomerLocation;
  orders: OrderItem[];
  vendorName: string;
  vendorLocation: VendorLocation;
  vendorPhone: string;
  status: "pending" | "picked" | "in progress" | "filling" | "filling completed" | "completed";
}

export const mockOrders: MockOrder[] = [
  {
    id: "ORD001",
    customerName: "Nana Ama Amankwah",
    customerPhone: "055 414 4611",
    customerLocation: {
      lat: 6.6745,
      lng: -1.5716,
      name: "Brunei Hostel",
    },
    orders: [
      { item: "Jollof Rice with Chicken", quantity: 2, price: 35 },
      { item: "Fruit Smoothie", quantity: 1, price: 15 },
    ],
    vendorName: "Mama Grace's Kitchen",
    vendorLocation: {
      lat: 6.6792,
      lng: -1.5745,
      name: "Commercial Area",
    },
    vendorPhone: "024 567 8901",
    status: "pending",
  },
  {
    id: "ORD002",
    customerName: "Kwame Mensah",
    customerPhone: "020 123 4567",
    customerLocation: {
      lat: 6.6812,
      lng: -1.5689,
      name: "Suncity Hostel",
    },
    orders: [
      { item: "Waakye with Spaghetti", quantity: 1, price: 25 },
      { item: "Fried Plantain", quantity: 2, price: 10 },
      { item: "Kebab", quantity: 3, price: 8 },
    ],
    vendorName: "Sister Esi's Chop Bar",
    vendorLocation: {
      lat: 6.6778,
      lng: -1.5721,
      name: "Pentecost Bus Stop",
    },
    vendorPhone: "050 987 6543",
    status: "pending",
  },
  {
    id: "ORD003",
    customerName: "Akua Serwaa Bonsu",
    customerPhone: "054 321 6789",
    customerLocation: {
      lat: 6.6875,
      lng: -1.5654,
      name: "Hall 7",
    },
    orders: [
      { item: "Banku with Tilapia", quantity: 1, price: 40 },
      { item: "Pepper Sauce", quantity: 2, price: 5 },
    ],
    vendorName: "Delta Grill",
    vendorLocation: {
      lat: 6.6831,
      lng: -1.5698,
      name: "KSB Area",
    },
    vendorPhone: "027 456 7890",
    status: "picked",
  },
  {
    id: "ORD004",
    customerName: "Yaw Asante Osei",
    customerPhone: "055 789 1234",
    customerLocation: {
      lat: 6.6712,
      lng: -1.5776,
      name: "Main Library",
    },
    orders: [
      { item: "Fufu with Light Soup", quantity: 1, price: 45 },
      { item: "Goat Meat", quantity: 1, price: 15 },
      { item: "Minerals (Fanta)", quantity: 2, price: 6 },
    ],
    vendorName: "Auntie Ama's Canteen",
    vendorLocation: {
      lat: 6.6758,
      lng: -1.5742,
      name: "SRC Bus Stop",
    },
    vendorPhone: "024 111 2222",
    status: "in progress",
  },
  {
    id: "ORD005",
    customerName: "Ewurabena Danso",
    customerPhone: "050 333 4444",
    customerLocation: {
      lat: 6.6698,
      lng: -1.5791,
      name: "Gaza Hostel",
    },
    orders: [
      { item: "Kenkey with Fish", quantity: 2, price: 20 },
      { item: "Shito", quantity: 1, price: 5 },
    ],
    vendorName: "Omega Foods",
    vendorLocation: {
      lat: 6.6734,
      lng: -1.5758,
      name: "Pharmacy Bus Stop",
    },
    vendorPhone: "027 555 6666",
    status: "filling",
  },
  {
    id: "ORD006",
    customerName: "Kofi Boateng",
    customerPhone: "024 777 8888",
    customerLocation: {
      lat: 6.6845,
      lng: -1.5623,
      name: "Conti Bus Stop",
    },
    orders: [
      { item: "Rice and Stew", quantity: 3, price: 30 },
      { item: "Sausage", quantity: 2, price: 10 },
    ],
    vendorName: "Mama Grace's Kitchen",
    vendorLocation: {
      lat: 6.6792,
      lng: -1.5745,
      name: "Commercial Area",
    },
    vendorPhone: "024 567 8901",
    status: "filling completed",
  },
  {
    id: "ORD007",
    customerName: "Maame Esi Poku",
    customerPhone: "020 999 0000",
    customerLocation: {
      lat: 6.6768,
      lng: -1.5667,
      name: "Medical Village",
    },
    orders: [
      { item: "Ampesi with Kontomire", quantity: 1, price: 35 },
      { item: "Riped Plantain", quantity: 1, price: 8 },
      { item: "Eggs (2)", quantity: 1, price: 6 },
    ],
    vendorName: "Bismark's Fast Food",
    vendorLocation: {
      lat: 6.6801,
      lng: -1.5703,
      name: "Hall 7 Junction",
    },
    vendorPhone: "054 222 3333",
    status: "completed",
  },
];

export const mockRider = {
  userId: "RDR001",
  username: "delivery_rider",
  fullName: "Test Rider",
  phoneNumber: "+233541234567",
  location: "KNUST Campus",
};
