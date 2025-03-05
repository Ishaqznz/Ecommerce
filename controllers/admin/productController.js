const path = require('path')
const fs = require('fs')
const Product = require('../../model/productSchema')
const Category = require('../../model/categorySchema')
const User = require('../../model/userSchema')
const sharp = require('sharp');
const multer = require('multer');



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads/product-images');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  

  const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Not an image! Please upload images only.'), false);
      }
    }
  });


const addProducts = async (req, res) => {
    
    try {
        const categories = await Category.find({isListed: true})
        res.render('product-add', { categories })
    } catch (error) {
        res.status(500).send('error while loading product add page')
        res.redirect('/admin.pageError')
    }
}

const addingProduct = async (req, res) => {
    console.log("------------------------------");
    
    try {
        console.log('Received body:', req.body);
        console.log('Received files:', req.files);
        
        const products = req.body;

        let sizes = JSON.parse(products.productSizes)

        let stockCount = Object.values(sizes).reduce((sum, qty) => sum + qty, 0)

        console.log('stock total count: ', stockCount);
   
        const productExists = await Product.findOne({
            productName: products.productName
        });
        console.log('Product exists?:', productExists);

        if (!productExists) {
            console.log('Processing images...');
            let images = req.files ? req.files.map(file => file.filename) : [];
            console.log('Mapped images:', images);

            // Process images if they exist
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    console.log('Processing image:', i + 1);
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    
                    // Make sure the directory exists
                    const dir = path.join('public', 'uploads', 'product-images');
                    if (!fs.existsSync(dir)){
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                }
            }

            console.log('Looking for category:', products.productCategory);
            const categoryId = await Category.findOne({ _id: products.productCategory });
            console.log('Found category:', categoryId);
            
            if (!categoryId) {
                return res.status(400).json('Invalid category name');
            }

            const sizes = products.productSizes ? JSON.parse(products.productSizes) : {};
            console.log('Parsed sizes:', sizes);

            const newProduct = new Product({
                productName: products.productName,
                description: products.productDescription,
                category: categoryId._id,
                regularPrice: products.productAmount,
                salePrice: products.productAmount,
                createdAt: new Date(),
                quantity: stockCount,
                sizes: sizes,  
                color: 'green',
                productImage: images,
                status: 'Available'
            });


            console.log('Attempting to save product:', newProduct);
            await newProduct.save();
            console.log('Product saved successfully');
            return res.status(201).json({"message": "success"});
        } else {
            return res.status(400).json('Product already exists, please try with another name');
        }
    } catch (error) {
        console.log('Error while saving product:', error);
        console.log('Error stack:', error.stack);
        return res.status(500).json({ error: error.message });
    }
}

const getProducts = async (req, res) => {
    try {
        if (req.session.admin) {
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 4;
            const skip = (page - 1) * limit;

            const productData = await Product.find({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            })
                .skip(skip)
                .limit(limit)
                .populate('category')
                .exec();

            const count = await Product.countDocuments({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            });

            const category = await Category.find({ isListed: true });

            if (category) {
                const totalPages = Math.ceil(count / limit);

                console.log(productData);
                
                
                res.render('products', {
                    data: productData,
                    search: search,
                    data: productData,
                    currentPage: page,
                    totalPages: totalPages,
                    cat: category,
                    message:req.flash('success')
                });
            } else {
                res.render('page-404');
            }
        }
    } catch (error) {
        console.error('Pagination Error:', error);
        res.redirect('/admin/pageError');
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });

        const categoryName = await Category.findOne({ _id: product.category._id }, { name: true, _id: false })
        console.log('name of the category: ', categoryName);
        
        if (product) {
            return res.render('edit-product', {
                product: product,
                sizes: product.sizes ? Object.fromEntries(product.sizes) : {}, 
                pageTitle: 'Edit Product',
                path: '/admin/products',
                categoryName: categoryName.name
            });
        }
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).redirect('/admin/products');
    }
};



const editProduct = async (req, res) => {
    const id = req.params.id;

    const {
        productName,
        productDescription, 
        productCategory, 
        regularPrice, 
        salePrice, 
        quantity, 
        color, 
        brand, 
        productOffer, 
        existingImages,  
        sizes
    } = req.body;

    try {
        console.log('-------------');
        console.log("Product ID:", id);
        console.log("Request Body:", req.body);
        console.log("Received Files:", req.files);

        const categoryExists = await Category.findOne({ name: productCategory });
        if (!categoryExists) {
            return res.status(400).json({ success: false, message: "Category does not exist!" });
        }

        let parsedSizes = {};
        if (typeof sizes === "string") {
            try {
                parsedSizes = JSON.parse(sizes);
            } catch (error) {
                return res.status(400).json({ message: "Invalid sizes format!" });
            }
        } else {
            parsedSizes = sizes;
        }

        const stockCount = Object.values(parsedSizes)
            .map(Number)
            .reduce((sum, qty) => sum + qty, 0);

        let updatedImages = Array.isArray(existingImages) ? existingImages : [];
        if (typeof existingImages === "string") {
            try {
                updatedImages = JSON.parse(existingImages);
            } catch (err) {
                console.error("Error parsing existing images:", err);
                return res.status(400).json({ message: "Invalid existing images format!" });
            }
        }

        if (req.files && req.files.length > 0) {
            const newImageFilenames = req.files.map(file => file.filename);
            updatedImages = [...updatedImages, ...newImageFilenames];

            const path = require('path');
            const sharp = require('sharp');
            const fs = require('fs');

            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);

                const dir = path.join('public', 'uploads', 'product-images');
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir, { recursive: true });
                }

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
            }
        }

        console.log("Updated Images Array:", updatedImages);

        let status = stockCount > 0 ? "Available" : "out of stock";

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName,
                description: productDescription, 
                category: categoryExists._id, 
                regularPrice,
                salePrice,
                finalPrice: salePrice - (salePrice * (productOffer || 0) / 100), 
                quantity: stockCount,
                color,
                brand,
                productOffer,
                productImage: updatedImages, 
                sizes: parsedSizes,
                status,
            },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found!" });
        }

        res.status(200).json({
            message: "Product updated successfully!",
            updatedProduct,
        });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const deleteProduct = async (req, res) => {
    const id = req.params.id;

    console.log(id);
    

    console.log('delteing product');
    
    try {

        const product = await Product.findById(id);

        console.log(product);
        
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.productImage && product.productImage.length > 0) {
            product.productImage.forEach(imageName => {
                const imagePath = path.join(__dirname, '../../public/uploads/product-images', imageName);

                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
        }

        await Product.findByIdAndDelete(id);

        res.status(201).json({
            success: true
        });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: "Error deleting product"
        });
    }
}



const productDetail = async (req, res) => {
    try {

        const user = req.session.user;
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').lean();

        console.log('products of the data: ', product);

        console.log('product sizes: ', product.sizes);
        
        
        const userData = await User.findOne({ _id: user });

        if (!product || product.isBlocked) {
            return res.status(404).render('user/error', { message: 'Product not found' });
        }

        const categories = await Category.find({ isListed: true }).lean();

        const originalPrice = product.regularPrice || 0;
        const categoryDiscount = product.category?.categoryOffer || 0;
        const productDiscount = product.productOffer || 0;
        const maxDiscount = Math.max(categoryDiscount, productDiscount);
        const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

        const sizeStock = product.sizes instanceof Map ? Object.fromEntries(product.sizes.entries()) : {};

        const updatedProduct = {
            ...product,
            originalPrice,
            finalPrice,
            maxDiscount,
            sizeStock 
        };

        console.log('Product: ', updatedProduct);

        res.render('user/product-detail', {
            product: updatedProduct,
            user: userData,
            categories
        });

    } catch (error) {
        console.error(error);
        res.status(500).render('user/error', { message: 'Internal Server Error' });
    }
};


const deleteProductImage = async (req, res) => {
    const { productId } = req.params;
    const { imageName } = req.body;

    try {

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found!" });
        }

        const updatedImages = product.productImage.filter(img => img !== imageName);
        if (updatedImages.length === product.productImage.length) {
            return res.status(400).json({ message: "Image not found in the product!" });
        }

        product.productImage = updatedImages;
        await product.save();

        const imagePath = path.join(__dirname, "../../public/uploads/product-images", imageName);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        return res.status(200).json({ message: "Image deleted successfully!" });
    } catch (error) {
        console.error("Error deleting image:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


const toggleStatus = async (req, res) => {
    try {

        const productId = req.params.productId
        const { isBlocked } = req.body

        console.log('data: ', productId, isBlocked);

        const product = await Product.findByIdAndUpdate(productId, {
            isBlocked: isBlocked
        })

        if (isBlocked) {
            const productUpdate = await Product.findByIdAndUpdate(productId, {
                isBlocked: isBlocked
            }, {
                new: true
            })

            if (productUpdate) {
                return res.status(200).json({ success: true, message: 'Product status cyhanged successfully '})
            }
        }

        const productUpdate = await Product.findByIdAndUpdate(productId, {
            isBlocked: isBlocked
        }, {
            new: true
        })

        res.status(200).json({ success: true, message: 'Product status cyhanged successfully '})
        

    } catch (error) {
        
        console.log('Error while toggling product status: ', error);
        res.send(500).json({ success: false, message: 'Internal Server!' })
    }
}



module.exports = {
    addProducts,
    getProducts,
    addingProduct,
    getEditProduct,
    editProduct,
    deleteProduct,
    productDetail,
    deleteProductImage,
    toggleStatus
}

