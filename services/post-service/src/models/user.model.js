import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		fullname: {
			firstName: {
				type: String,
				required: true,
			},
			lastName: {
				type: String,
				required: true,
			},
		},
		role: {
			type: String,
			default: 'user',
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.model('User', userSchema);