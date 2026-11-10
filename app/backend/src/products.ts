import { DataConnect } from 'firebase-admin/data-connect';

export interface Product {
  productID: string;
  description: string | null;
  expiresOn: string | null;
}
export interface ProductLookup {
  findByBarcode(barcode: string): Promise<Product | null>;
}

const LOOKUP = `query LookupStock($productID: String!) {
  stock(key: { productID: $productID }) {
    productID
    description
    expiresOn
  }
}`;

export function createProductLookup(dataConnect: Pick<DataConnect, 'executeGraphqlRead'>): ProductLookup {
  return {
    async findByBarcode(barcode) {
      const result = await dataConnect.executeGraphqlRead<{ stock: Product | null }, { productID: string }>(
        LOOKUP, { variables: { productID: barcode } },
      );
      const stock = result.data?.stock;
      if (stock === null) return null;
      if (!stock || stock.productID !== barcode ||
          (stock.description !== null && typeof stock.description !== 'string') ||
          (stock.expiresOn !== null && typeof stock.expiresOn !== 'string')) {
        throw new Error('Invalid Data Connect response');
      }
      return stock;
    },
  };
}
