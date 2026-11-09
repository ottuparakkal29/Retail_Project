export type Product = {
  name: string;
  category: string;
  detail: string;
  price: number;
  oldPrice: number;
  rating: string;
  reviews: string;
  discount: number;
  image: number;
};

export const products: Product[] = [
  { name: 'Fresh Apples', category: 'Fruits', detail: '1 kg', price: 120, oldPrice: 150, rating: '4.7', reviews: '2.5k', discount: 20, image: require('../../assets/images/store/apples.jpg') },
  { name: 'Organic Bananas', category: 'Fruits', detail: '1 kg', price: 60, oldPrice: 80, rating: '4.6', reviews: '1.8k', discount: 25, image: require('../../assets/images/store/bananas.jpg') },
  { name: 'Juicy Tomatoes', category: 'Vegetables', detail: '1 kg', price: 50, oldPrice: 65, rating: '4.5', reviews: '1.2k', discount: 23, image: require('../../assets/images/store/tomatoes.jpg') },
  { name: 'Fresh Spinach', category: 'Vegetables', detail: '250 g', price: 30, oldPrice: 40, rating: '4.6', reviews: '980', discount: 25, image: require('../../assets/images/store/spinach.jpg') },
  { name: 'Farm Fresh Milk', category: 'Dairy', detail: '1 L', price: 70, oldPrice: 90, rating: '4.7', reviews: '2.1k', discount: 22, image: require('../../assets/images/store/milk.jpg') },
  { name: 'Brown Bread', category: 'Bakery', detail: '400 g', price: 45, oldPrice: 60, rating: '4.5', reviews: '876', discount: 25, image: require('../../assets/images/store/bread.jpg') },
  { name: 'Crunchy Broccoli', category: 'Vegetables', detail: '500 g', price: 55, oldPrice: 70, rating: '4.6', reviews: '640', discount: 21, image: require('../../assets/images/store/broccoli.jpg') },
  { name: 'Orange Juice', category: 'Beverages', detail: '1 L', price: 95, oldPrice: 120, rating: '4.4', reviews: '530', discount: 20, image: require('../../assets/images/store/oranges.jpg') },
  { name: 'Potato Chips', category: 'Snacks', detail: '150 g', price: 35, oldPrice: 45, rating: '4.3', reviews: '720', discount: 22, image: require('../../assets/images/store/chips.jpg') },
  { name: 'Golden Croissants', category: 'Bakery', detail: '4 pcs', price: 80, oldPrice: 100, rating: '4.8', reviews: '390', discount: 20, image: require('../../assets/images/store/croissants.jpg') },
  { name: 'Natural Hand Wash', category: 'Personal care', detail: '250 ml', price: 110, oldPrice: 140, rating: '4.5', reviews: '310', discount: 21, image: require('../../assets/images/store/handwash.jpg') },
  { name: 'Organic Avocados', category: 'Organic', detail: '2 pcs', price: 85, oldPrice: 110, rating: '4.7', reviews: '460', discount: 23, image: require('../../assets/images/store/avocado.jpg') },
];
