import Log from "sap/base/Log";
import type StandardTreeItem from "sap/m/StandardTreeItem";
import type Tree from "sap/m/Tree";
import BaseObject from "sap/ui/base/Object";

export default class TreeSelector extends BaseObject {
    private Tree!: Tree;
    private fnResolveTreeHasBeenSet!: (tree: Tree) => void;
    private WhenTreeHasBeenSet: Promise<Tree>;
    public WhenTreeLoadingIsDone: Promise<{ tree: Tree }>;

    constructor() {
        super();

        // Promise resolve khi setBoundTree được gọi
        this.WhenTreeHasBeenSet = new Promise<Tree>((fnResolve) => {
            this.fnResolveTreeHasBeenSet = fnResolve;
        });

        // Promise chờ tree load xong dữ liệu
        this.WhenTreeLoadingIsDone = new Promise<{ tree: Tree }>((fnResolve, fnReject) => {
            this.WhenTreeHasBeenSet.then((tree: Tree) => {
                const binding = tree.getBinding("items");

                if (!binding) {
                    fnReject({ tree });
                    return;
                }

                const items = tree.getItems();

                if (items.length) {
                    fnResolve({ tree });
                } else {
                    // Chờ event change nếu dữ liệu chưa có
                    binding.attachEventOnce("change", () => {
                        const loadedItems = tree.getItems();

                        if (loadedItems.length) {
                            fnResolve({ tree });
                        } else {
                            fnReject({ tree });
                        }
                    });
                }


            })
        })
    }

    // Bind Tree
    public setBoundTree(tree: Tree): void {
        this.Tree = tree;
        this.fnResolveTreeHasBeenSet(tree);
    }

    // Chọn item theo binding path (tự động expand parent nodes nếu cần)
    public async selectTreeItem(BindingPath: string): Promise<void> {
        try {
            await this.WhenTreeLoadingIsDone;

            const tree = this.Tree;
            const items = <StandardTreeItem[]>tree.getItems();

            // Clear previous selection
            tree.removeSelections(true);

            // // Tìm item theo binding path
            const targetItem = items.find(
                (item) => item.getBindingContext()?.getProperty("id") === BindingPath
            );

            if (!targetItem) {
                Log.warning(`Cannot find Tree item with path ${BindingPath}`);
                return;
            }

            // Expand all parent nodes trước khi select
            let Parent = <any>targetItem.getParent();

            while (Parent) {
                if (Parent !== tree && Parent.setExpanded) {
                    Parent.setExpanded(true);
                }
                Parent = Parent.getParent();
            }

            // Select item
            tree.setSelectedItem(targetItem);
        } catch (err) {
            Log.warning(
                `Cannot select Tree item with path ${BindingPath}, tree may have no items`
            );
        }
    }

    // Xoá tất cả selection
    public clearTreeSelection(): void {
        this.WhenTreeHasBeenSet.then(() => {
            if (this.Tree.removeSelections) {
                this.Tree.removeSelections(true);
            }
        })
    }
}