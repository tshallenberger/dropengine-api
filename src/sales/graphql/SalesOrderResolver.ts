import { Logger, NotFoundException } from "@nestjs/common";
import { Args, Mutation, Query, Resolver, Subscription } from "@nestjs/graphql";
import { ISalesOrderProps } from "@sales/domain";
import { SalesService } from "@sales/services";
import { PubSub } from "graphql-subscriptions";
import mongoose from "mongoose";
import { SalesOrdersQueryArgs } from "./dto";
import { PaginatedSalesOrders } from "./dto/PaginatedSalesOrders";
import { SalesOrder } from "./models";

const pubSub = new PubSub();

@Resolver((of) => SalesOrder)
export class SalesOrderResolver {
  private readonly logger: Logger = new Logger(SalesOrderResolver.name);

  constructor(private readonly service: SalesService) {}

  @Query((returns) => SalesOrder)
  async salesOrder(@Args("id") id: string): Promise<SalesOrder> {
    const salesOrder = await this.service.findById(id);
    if (!salesOrder) {
      throw new NotFoundException(id);
    }
    return salesOrder;
  }

  @Query((returns) => [SalesOrder])
  async salesOrders(@Args() args: SalesOrdersQueryArgs): Promise<SalesOrder[]> {
    this.logger.debug(args);
    const filter: mongoose.FilterQuery<ISalesOrderProps> = {};
    if (args.orderName) filter.orderName = args.orderName;
    let result = await this.service.query({
      limit: args.size,
      skip: args.page,
      filter: filter,
    });
    return result.data.map((d) => d.raw());
  }
  @Query((returns) => PaginatedSalesOrders)
  async paginatedSalesOrders(
    @Args() args: SalesOrdersQueryArgs
  ): Promise<PaginatedSalesOrders> {
    this.logger.debug(args);
    const filter: mongoose.FilterQuery<ISalesOrderProps> = {};
    if (args.orderName) filter.orderName = args.orderName;
    if (args.merchantName) filter["merchant.name"] = { $eq: args.merchantName };
    filter.orderDate = { $gte: args.startDate, $lte: args.endDate };
    const sort = {};
    sort[args.sortBy] = args.sortDir;
    const params = {
      limit: args.size,
      sort,
      skip: args.page * args.size,
      filter: filter,
    };
    let result = await this.service.query(params);
    let options = await this.service.options(params);
    let orders = result.data.map((d) => d.raw());

    return new PaginatedSalesOrders({
      count: result.total,
      page: result.page,
      pages: result.pages,
      size: result.size,
      options: options,
      data: orders,
    });
  }

  @Subscription((returns) => SalesOrder)
  salesOrderAdded() {
    return pubSub.asyncIterator("salesOrderAdded");
  }
}
