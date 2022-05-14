import {
  Entity,
  Property,
  ManyToOne,
  PrimaryKey,
  Collection,
  OneToMany,
  wrap,
  Cascade,
} from "@mikro-orm/core";
import { UUID } from "@shared/domain";
import { IProductProps } from "../interfaces";
import { ICustomOptionProps } from "../valueObjects";
import { DbProductType } from "./ProductType.entity";
import { DbProductVariant } from "./ProductVariant.entity";

@Entity({ tableName: "products" })
export class DbProduct {
  @PrimaryKey({ type: "uuid", defaultRaw: "uuid_generate_v4()" })
  id!: string;
  @Property()
  type: string;
  @Property({unique: true})
  sku: string;
  @Property()
  pricingTier: string;
  @Property({ type: "json" })
  tags: string[];
  // @Property({ type: "json" })
  // categories: string[];
  @Property()
  image?: string | undefined;
  @Property()
  svg?: string | undefined;
  @Property({ type: "json" })
  customOptions: ICustomOptionProps[];

  @OneToMany(() => DbProductVariant, (v) => v.product, {
    cascade: [Cascade.ALL],
    orphanRemoval: true,
  })
  variants = new Collection<DbProductVariant>(this);

  // @Property()
  // productTypeId: string;

  @ManyToOne(() => DbProductType)
  productType: DbProductType;

  @Property({ onCreate: () => new Date() })
  createdAt: Date;
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date;

  public props(maxDepth?: number | undefined): IProductProps {
    const newMaxDepth = maxDepth - 1;
    const props: IProductProps = {
      id: this.id,
      type: this.type,
      pricingTier: this.pricingTier,
      sku: this.sku,
      tags: this.tags,
      image: this.image,
      svg: this.svg,
      // categories: this.categories,
      customOptions: this.customOptions,
      variants: this.variants.isInitialized()
        ? this.variants.getItems().map((v) => v.props(newMaxDepth))
        : null,
      productType:
        this.productType && maxDepth > 0
          ? this.productType.props(newMaxDepth)
          : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    return props;
  }

  /**
   * Copies props into specified `DbProduct` and returns `DbProduct`
   * @param props Properties to copy -> (e)
   * @param e Target `DbProduct`
   * @returns {DbProduct} Mutated `DbProduct`
   */
  public static copy(props: IProductProps, e: DbProduct) {
    try {
      props.id = e.id;
      props.createdAt = e.createdAt;
      e.variants.getItems().forEach((v) => {
        v.product = e;
      });
      wrap(e).assign(props, { updateNestedEntities: true, mergeObjects: true });

      return e;
    } catch (error) {
      throw error;
    }
  }
}
