import { Directive, Field, ID, ObjectType } from "@nestjs/graphql";
import {
  ISalesCustomer,
  ISalesLineItemProps,
  ISalesOrderProps,
  OrderStatus,
} from "@sales/domain";
import { SalesOrderEvent } from "@sales/domain/events";
import { ISalesMerchant } from "@sales/domain/model/SalesMerchant";
import { IAddress } from "@shared/domain";
import { Address } from "@shared/graphql";
import { Customer } from "./Customer";
import { Merchant } from "./Merchant";
import { SalesLineItem } from "./SalesLineItem";

@ObjectType({ description: "SalesOrder" })
export class SalesOrder implements ISalesOrderProps {
  constructor(props?: ISalesOrderProps | undefined) {
    if (props) {
      this.id = props.id;
    }
  }
  @Field((type) => ID)
  id: string;
  @Field({ nullable: true })
  seller: string;
  @Field()
  orderName: string;
  @Field()
  orderNumber: number;
  @Field()
  orderDate: Date;
  @Field()
  orderStatus: OrderStatus;
  @Field((type) => [SalesLineItem])
  lineItems: SalesLineItem[];
  @Field((type) => Customer)
  customer: ISalesCustomer;
  @Field((type) => Merchant)
  merchant: ISalesMerchant;
  @Field((type) => Address)
  shippingAddress: IAddress;
  @Field((type) => Address)
  billingAddress: IAddress;
  events: SalesOrderEvent<any>[];
  @Field()
  updatedAt: Date;
  @Field()
  createdAt: Date;
}
