const Category = require('../../model/categorySchema')
const Product = require('../../model/productSchema')



const addOffer = async (req, res) => {

    try {
        
        const { categoryName, offerPercentage } = req.body;

        console.log("Received Offer Data:", categoryName, offerPercentage);

        if (!categoryName || !offerPercentage) {
            return res.status(400).json({ success: false, message: "Category name and offer percentage are required." });
        }

        const category = await Category.findOneAndUpdate(
            { name: categoryName },
            { $set: { categoryOffer: offerPercentage } },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        res.status(200).json({ success: true, message: "Successfully added the offer!", updatedCategory: category });

    } catch (error) {

        console.error("Error while adding the offer:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


const deleteOffer = async (req, res) => {
    try {
        
        const { categoryName } = req.body
        console.log('Category name: ', categoryName);

        const removeOffer = await Category.updateOne({ name: categoryName }, 
            { $set: { categoryOffer: 0 } }
        )

        if (removeOffer.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: 'Successfully removed the offer!' })
        }

        res.status(500).json({ success: false, message: 'Error while deleting the offer!' })

        
    } catch (error) {
        
        console.log('Error while removing the offer', error);
        res.redirect('/admin/pageError')

    }
}

const productAddOffer = async (req, res) => {

    try {

        const { productId, offerPercentage } = req.body

        console.log('product Idd: ', productId);
        console.log('offer percentagge: ', offerPercentage);
        
        
        const addProductOffer = await Product.findByIdAndUpdate(productId, 
            { productOffer: offerPercentage },
            { new: true}
        )

        if (addProductOffer) {
            return res.status(200).json({ success: true, message: 'Offer added Successfully!'})
        }

        res.status(500).json({ success: false, message: 'Error while updating the offer!'})


    } catch (error) {
        
        console.log('Error while loading the product offer', error);
        res.redirect('/admin/pageError')

    }
}


const deleteProductOffer = async (req, res) => {
    try {
        
        const { productId } = req.body
        console.log('product Id: ', productId);

        const deleteProductOffer = await Product.findByIdAndUpdate(productId, 
            { productOffer: 0 },
            { new: true }
        )

        if (deleteProductOffer) {
            return res.status(200).json({ success: true, message: 'product offer deleted successfully!' })
        }

        res.status(500).json({ success: false, message: 'Error while deleting offer! '})
        
    } catch (error) {
        
        console.log('Error while deleting the product offer', error);
        res.redirect('/admin/pageError')

    }

}


module.exports = {
    addOffer,
    deleteOffer,
    productAddOffer,
    deleteProductOffer
}