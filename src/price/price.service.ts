import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdatePriceDto } from './dto/update-price.dto';

export type PriceItem = {
  id: number;
  price: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PRICE_CONFIG_KEY = 'prices';

@Injectable()
export class PriceService {
  constructor(private readonly prismaService: PrismaService) {}

  private async getRawPrices(): Promise<PriceItem[]> {
    const record = await this.prismaService.globalSetting.findUnique({
      where: { key: PRICE_CONFIG_KEY },
    });

    if (!record?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(record.value) as PriceItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async saveRawPrices(prices: PriceItem[]): Promise<void> {
    await this.prismaService.globalSetting.upsert({
      where: { key: PRICE_CONFIG_KEY },
      update: {
        value: JSON.stringify(prices),
      },
      create: {
        key: PRICE_CONFIG_KEY,
        value: JSON.stringify(prices),
      },
    });
  }

  async getPrices(): Promise<PriceItem[]> {
    const prices = await this.getRawPrices();

    if (prices.length > 0) {
      return prices;
    }

    const defaultPrice = await this.prismaService.globalSetting.findUnique({
      where: { key: 'defaultPrice' },
    });

    if (!defaultPrice?.value) {
      return [];
    }

    const numericPrice = Number(defaultPrice.value);

    if (!Number.isFinite(numericPrice)) {
      return [];
    }

    const now = new Date();
    const initialPrice: PriceItem = {
      id: 1,
      price: numericPrice,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveRawPrices([initialPrice]);
    return [initialPrice];
  }

  async upsertPrice(data: UpdatePriceDto): Promise<PriceItem> {
    const prices = await this.getRawPrices();
    const now = new Date();
    const index = prices.findIndex((item) => item.id === data.id);

    if (index >= 0) {
      prices[index] = {
        ...prices[index],
        price: data.price,
        active: data.active ?? prices[index].active,
        updatedAt: now,
      };

      await this.saveRawPrices(prices);
      return prices[index];
    }

    const newItem: PriceItem = {
      id: data.id,
      price: data.price,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    prices.push(newItem);
    await this.saveRawPrices(prices);

    return newItem;
  }
}
