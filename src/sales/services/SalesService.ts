import { Injectable, Scope } from "@nestjs/common";
import {
  MongoDomainEventRepository,
  SalesOrderQueryResult,
  SalesOrderRepository,
} from "@sales/database";
import { SalesOrder } from "@sales/domain";
import { DomainEvent } from "@shared/domain/events/DomainEvent";
import { MongoQueryParams } from "@shared/mongo";

@Injectable({ scope: Scope.DEFAULT })
export class SalesService {
  constructor(
    private readonly _repo: SalesOrderRepository,
    public _events: MongoDomainEventRepository
  ) {}

  public async findById(id: string) {
    return await this._repo.load(id);
  }

  /**
   * Queries the SalesOrder repository for a paginated, filtered result set.
   * @param params SalesOrderQueryParams
   * @returns SalesOrderQueryResult
   */
  public async query(params: MongoQueryParams): Promise<SalesOrderQueryResult> {
    let result = await this._repo.query(params);
    return result;
  }

  public async delete(id: string) {
    return await this._repo.delete(id);
  }

  async loadEvents(id: string): Promise<DomainEvent<SalesOrder>[]> {
    return await this._events.findByAggregateId(id);
  }
}
